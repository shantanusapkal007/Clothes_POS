import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";
import type { FastifyPluginAsync } from "fastify";
import { calculateCheckout } from "../lib/billing.js";

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
const tenantHeadersSchema = z.object({
  "x-organization-id": z.string().min(1),
  "x-store-id": z.string().min(1),
  "x-user-id": z.string().optional()
});

function getTenant(headers: unknown) {
  return tenantHeadersSchema.parse(headers);
}

const mapBill = (bill: {
  id: string;
  totalAmount: Decimal;
  discountAmount: Decimal;
  taxAmount: Decimal;
  finalAmount: Decimal;
  paymentMethod: string;
  createdAt: Date;
  customerName?: string | null;
  customerPhone?: string | null;
  billDiscountPercent?: Decimal;
  billManualDiscountAmount?: Decimal;
  items?: Array<{
    id: string;
    productId: string;
    quantity: number;
    price: Decimal;
    discount: Decimal;
    tax: Decimal;
    total: Decimal;
    productName: string;
  }>;
}) => ({
  id: bill.id,
  totalAmount: Number(bill.totalAmount),
  discountAmount: Number(bill.discountAmount),
  taxAmount: Number(bill.taxAmount),
  finalAmount: Number(bill.finalAmount),
  paymentMethod: bill.paymentMethod,
  createdAt: bill.createdAt,
  customerName: bill.customerName ?? undefined,
  customerPhone: bill.customerPhone ?? undefined,
  billDiscountPercent: bill.billDiscountPercent ? Number(bill.billDiscountPercent) : 0,
  billManualDiscountAmount: bill.billManualDiscountAmount ? Number(bill.billManualDiscountAmount) : 0,
  items:
    bill.items?.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      price: Number(item.price),
      discount: Number(item.discount),
      tax: Number(item.tax),
      total: Number(item.total),
      productName: item.productName
    })) ?? []
});

const billRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const tenant = getTenant(request.headers);
    const bills = await fastify.prisma.bill.findMany({
      where: {
        storeId: tenant["x-store-id"]
      },
      include: { items: true },
      orderBy: {
        createdAt: "desc"
      }
    });

    return bills.map(mapBill);
  });

  fastify.get("/:id", async (request, reply) => {
    const tenant = getTenant(request.headers);
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const bill = await fastify.prisma.bill.findFirst({
      where: {
        id: params.id,
        storeId: tenant["x-store-id"]
      },
      include: { items: true }
    });

    if (!bill) {
      return reply.code(404).send({ message: "Bill not found" });
    }

    return mapBill(bill);
  });

  fastify.post("/", async (request, reply) => {
    const tenant = getTenant(request.headers);
    const body = checkoutSchema.parse(request.body);
    const productIds = body.items.map((item) => item.productId);
    const products = await fastify.prisma.product.findMany({
      where: {
        storeId: tenant["x-store-id"],
        id: {
          in: productIds
        }
      }
    });

    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of body.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return reply.code(400).send({ message: `Product missing: ${item.productId}` });
      }

      if (product.stock < item.quantity) {
        return reply.code(400).send({
          message: `Not enough stock for ${product.name}`
        });
      }
    }

    const summary = calculateCheckout(
      body.items,
      body.billDiscountPercent,
      body.billManualDiscountAmount
    );

    const bill = await fastify.prisma.$transaction(async (tx) => {
      const createdBill = await tx.bill.create({
        data: {
          organizationId: tenant["x-organization-id"],
          storeId: tenant["x-store-id"],
          cashierUserId: tenant["x-user-id"] ?? null,
          totalAmount: new Decimal(summary.totalAmount),
          discountAmount: new Decimal(summary.discountAmount),
          taxAmount: new Decimal(summary.taxAmount),
          finalAmount: new Decimal(summary.finalAmount),
          billDiscountPercent: new Decimal(body.billDiscountPercent ?? 0),
          billManualDiscountAmount: new Decimal(body.billManualDiscountAmount ?? 0),
          paymentMethod: body.paymentMethod,
          customerName: body.customerName ?? null,
          customerPhone: body.customerPhone ?? null
        }
      });

      // Seamless Khata Integration
      if (body.paymentMethod === "credit" && body.customerPhone) {
        // Find or create customer
        let customer = await tx.customer.findUnique({
          where: {
            storeId_phone: {
              storeId: tenant["x-store-id"],
              phone: body.customerPhone
            }
          }
        });

        if (!customer && body.customerName) {
          customer = await tx.customer.create({
            data: {
              organizationId: tenant["x-organization-id"],
              storeId: tenant["x-store-id"],
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
              organizationId: tenant["x-organization-id"],
              storeId: tenant["x-store-id"],
              customerId: customer.id,
              amount: new Decimal(summary.finalAmount),
              type: "credit",
              note: `Bill #${createdBill.id.slice(-6).toUpperCase()}`
            }
          });
        }
      }

      for (const item of summary.items) {
        const product = productMap.get(item.productId)!;

        await tx.billItem.create({
          data: {
            organizationId: tenant["x-organization-id"],
            storeId: tenant["x-store-id"],
            billId: createdBill.id,
            productId: item.productId,
            quantity: item.quantity,
            price: new Decimal(item.price),
            discount: new Decimal(item.discountAmount),
            tax: new Decimal(item.taxAmount),
            total: new Decimal(item.total),
            productName: product.name
          }
        });

        await tx.product.update({
          where: { id: item.productId },
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

    return reply.code(201).send({
      ...mapBill(bill),
      summary
    });
  });
};

export default billRoutes;
