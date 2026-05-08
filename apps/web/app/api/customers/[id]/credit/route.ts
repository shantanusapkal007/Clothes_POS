import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfig } from "../../../../../lib/database-url";
import { getErrorMessage } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { getTenantErrorStatus, requireActiveStore } from "../../../../../lib/tenant";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().min(1) });

const creditSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  note: z.string().optional(),
});

/* POST /api/customers/[id]/credit — add udhar/credit amount to balance */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = creditSchema.parse(await request.json());

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, storeId: tenant.storeId },
    });

    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    const updated = await prisma.customer.update({
      where: { id: params.id },
      data: { balance: { increment: body.amount } },
      include: { payments: { orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      balance: Number(updated.balance),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      payments: updated.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        note: p.note,
        billId: p.billId,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to add credit");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
