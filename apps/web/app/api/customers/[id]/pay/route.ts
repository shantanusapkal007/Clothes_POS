import { Decimal } from "@prisma/client/runtime/library";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfig } from "../../../../../lib/database-url";
import { getErrorMessage } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { getTenantErrorStatus, requireActiveStore } from "../../../../../lib/tenant";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().min(1) });

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.enum(["cash", "upi", "card"]).default("cash"),
  note: z.string().optional(),
  billId: z.string().optional(),
});

/* POST /api/customers/[id]/pay — record a payment and reduce balance */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = paymentSchema.parse(await request.json());

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, storeId: tenant.storeId },
    });

    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    const currentBalance = Number(customer.balance);
    if (body.amount > currentBalance) {
      return NextResponse.json(
        { message: `Payment ₹${body.amount} exceeds pending balance ₹${currentBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          organizationId: tenant.organizationId,
          storeId: tenant.storeId,
          customerId: params.id,
          billId: body.billId || null,
          amount: new Decimal(body.amount),
          method: body.method,
          note: body.note || null,
        },
      });

      return tx.customer.update({
        where: { id: params.id },
        data: { balance: { decrement: body.amount } },
        include: { payments: { orderBy: { createdAt: "desc" } } },
      });
    });

    return NextResponse.json({
      id: result.id,
      name: result.name,
      phone: result.phone,
      balance: Number(result.balance),
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      payments: result.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        note: p.note,
        billId: p.billId,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to record payment");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
