import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "../../../../../lib/errors";
import { mapBill } from "../../../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../../../lib/tenant";
import { adminDb } from "../../../../../lib/firebase/server";

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
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = refundSchema.parse(await request.json());

    const billRef = adminDb.collection("bills").doc(params.id);
    const billDoc = await billRef.get();

    if (!billDoc.exists || billDoc.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    }

    const bill = billDoc.data()!;

    if (bill.status === "refunded") {
      return NextResponse.json({ message: "Bill already refunded" }, { status: 400 });
    }

    const refundAmount = Number(bill.finalAmount);
    const refundRef = adminDb.collection("refunds").doc();
    const refundReason = body.reason || "Full refund";

    await adminDb.runTransaction(async (tx) => {
      // Create refund record
      tx.set(refundRef, {
        id: refundRef.id,
        organizationId: tenant.organizationId,
        storeId: tenant.storeId,
        billId: params.id,
        amount: refundAmount,
        reason: refundReason,
        createdAt: new Date()
      });

      // Restore stock for each item in the bill
      if (bill.items && Array.isArray(bill.items)) {
        for (const item of bill.items) {
          const productRef = adminDb.collection("products").doc(item.productId);
          const productDoc = await tx.get(productRef);
          if (productDoc.exists) {
            tx.update(productRef, { stock: (productDoc.data()?.stock || 0) + item.quantity });
          }
        }
      }

      // Mark bill as refunded
      tx.update(billRef, {
        status: "refunded",
        refundedAt: new Date(),
        refundReason,
        refunds: [...(bill.refunds || []), {
          id: refundRef.id,
          billId: params.id,
          amount: refundAmount,
          reason: refundReason,
          createdAt: new Date()
        }]
      });
    });

    const updatedBill = await billRef.get();
    return NextResponse.json(mapBill(updatedBill.data()), { status: 200 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to process refund");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
