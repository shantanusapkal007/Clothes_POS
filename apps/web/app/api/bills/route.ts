import { Decimal } from "@prisma/client/runtime/library";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { calculateCheckout } from "../../../lib/billing";
import { assertDatabaseConfig } from "../../../lib/database-url";
import { getApiErrorStatus, getErrorMessage } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { mapBill } from "../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../lib/tenant";

export const runtime = "nodejs";

const checkoutSchema = z.object({
  paymentMethod: z.string().min(1),
  billDiscountPercent: z.coerce.number().min(0).max(100).optional().default(0),
  billManualDiscountAmount: z.coerce.number().min(0).optional().default(0),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().positive(),
        price: z.coerce.number().min(0),
        discountPercent: z.coerce.number().min(0),
        manualDiscountAmount: z.coerce.number().min(0).default(0),
        taxPercent: z.coerce.number().min(0)
      })
    )
    .min(1),
  customerName: z.string().optional(),
  customerPhone: z.string().optional()
});

export async function GET(request: NextRequest) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const search = url.searchParams.get("search")?.trim() || "";
    const dateFrom = url.searchParams.get("from") || "";
    const dateTo = url.searchParams.get("to") || "";

    const where: Record<string, unknown> = { storeId: tenant.storeId };

    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
      ];
    }

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where: where as any,
        include: { items: true, refunds: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bill.count({ where: where as any }),
    ]);

    return NextResponse.json({
      bills: bills.map(mapBill),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load bills");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}
export async function POST(request: NextRequest) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const body = checkoutSchema.parse(await request.json());
    const productIds = body.items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: {
        storeId: tenant.storeId,
        id: {
          in: productIds
        }
      }
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of body.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json(
          { message: `Product missing: ${item.productId}` },
          { status: 400 }
        );
      }

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { message: `Not enough stock for ${product.name}` },
          { status: 400 }
        );
      }
    }

    const summary = calculateCheckout(
      body.items,
      body.billDiscountPercent,
      body.billManualDiscountAmount
    );

    const bill = await prisma.$transaction(async (tx) => {
      const createdBill = await tx.bill.create({
        data: {
          organizationId: tenant.organizationId,
          storeId: tenant.storeId,
          cashierUserId: tenant.user.id,
          totalAmount: new Decimal(summary.totalAmount),
          discountAmount: new Decimal(summary.discountAmount),
          taxAmount: new Decimal(summary.taxAmount),
          finalAmount: new Decimal(summary.finalAmount),
          billDiscountPercent: new Decimal(body.billDiscountPercent),
          billManualDiscountAmount: new Decimal(body.billManualDiscountAmount),
          paymentMethod: body.paymentMethod,
          customerName: body.customerName,
          customerPhone: body.customerPhone
        }
      });

      // Seamless Khata Integration
      if (body.paymentMethod === "credit" && body.customerPhone) {
        // Find or create customer
        let customer = await tx.customer.findUnique({
          where: {
            storeId_phone: {
              storeId: tenant.storeId,
              phone: body.customerPhone
            }
          }
        });

        if (!customer && body.customerName) {
          customer = await tx.customer.create({
            data: {
              organizationId: tenant.organizationId,
              storeId: tenant.storeId,
              name: body.customerName,
              phone: body.customerPhone,
              balance: 0
            }
          });
        }

        if (customer) {
          // Update balance
          await tx.customer.update({
            where: { id: customer.id },
            data: {
              balance: {
                increment: new Decimal(summary.finalAmount)
              }
            }
          });

          // Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              organizationId: tenant.organizationId,
              storeId: tenant.storeId,
              customerId: customer.id,
              amount: new Decimal(summary.finalAmount),
              type: "credit",
              note: `Bill #${createdBill.id.slice(-6)}`
            }
          });
        }
      }

      for (const item of summary.items) {
        const product = productMap.get(item.productId)!;

        await tx.billItem.create({
          data: {
            organizationId: tenant.organizationId,
            storeId: tenant.storeId,
            billId: createdBill.id,
            productId: item.productId,
            quantity: item.quantity,
            price: new Decimal(item.price),
            costPrice: product.costPrice,
            discount: new Decimal(item.discountAmount),
            tax: new Decimal(item.taxAmount),
            total: new Decimal(item.total),
            productName: product.name
          }
        });

        await tx.product.update({
          where: {
            id: item.productId
          },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      return tx.bill.findUniqueOrThrow({
        where: {
          id: createdBill.id
        },
        include: {
          items: true
        }
      });
    });

    return NextResponse.json(
      {
        ...mapBill(bill),
        summary
      },
      { status: 201 }
    );
  } catch (error) {
    const message = getErrorMessage(error, "Unable to save bill");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, getApiErrorStatus(error, 400)) });
  }
}
