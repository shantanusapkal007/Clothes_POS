import { Decimal } from "@prisma/client/runtime/library";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfig } from "../../../../../lib/database-url";
import { getErrorMessage } from "../../../../../lib/errors";
import { prisma } from "../../../../../lib/prisma";
import { mapBill } from "../../../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../../../lib/tenant";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().min(1) });
const refundSchema = z.object({
  reason: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = refundSchema.parse(await request.json());

    const bill = await prisma.bill.findFirst({
      where: { id: params.id, storeId: tenant.storeId },
      include: { items: true, refunds: true }
    });

    if (!bill) {
      return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    }

    if (bill.status === "refunded") {
      return NextResponse.json({ message: "Bill already refunded" }, { status: 400 });
    }

    const refundAmount = Number(bill.finalAmount);

    const updatedBill = await prisma.$transaction(async (tx) => {
      // Create refund record
      await tx.refund.create({
        data: {
          organizationId: tenant.organizationId,
          storeId: tenant.storeId,
          billId: bill.id,
          amount: new Decimal(refundAmount),
          reason: body.reason || "Full refund",
        }
      });

      // Restore stock for each item
      for (const item of bill.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } }
        });
      }

      // Mark bill as refunded
      return tx.bill.update({
        where: { id: bill.id },
        data: {
          status: "refunded",
          refundedAt: new Date(),
          refundReason: body.reason || "Full refund",
        },
        include: { items: true, refunds: true }
      });
    });

    return NextResponse.json(mapBill(updatedBill), { status: 200 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to process refund");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
