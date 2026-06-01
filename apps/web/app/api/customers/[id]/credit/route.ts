import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "../../../../../lib/errors";
import { getTenantErrorStatus, requireActiveStore } from "../../../../../lib/tenant";
import { adminDb } from "../../../../../lib/firebase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().min(1) });

const creditSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  note: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = creditSchema.parse(await request.json());

    const customerRef = adminDb.collection("customers").doc(params.id);
    const customerDoc = await customerRef.get();

    if (!customerDoc.exists || customerDoc.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    const currentBalance = Number(customerDoc.data()?.balance || 0);

    await adminDb.runTransaction(async (tx) => {
      tx.update(customerRef, {
        balance: currentBalance + body.amount,
        updatedAt: new Date()
      });

      const ledgerRef = adminDb.collection("ledgerEntries").doc();
      tx.set(ledgerRef, {
        id: ledgerRef.id,
        organizationId: tenant.organizationId,
        storeId: tenant.storeId,
        customerId: params.id,
        amount: body.amount,
        type: "credit",
        note: body.note || "Credit added",
        date: new Date(),
        createdAt: new Date()
      });
    });

    const updatedDoc = await customerRef.get();
    const paymentsSnap = await adminDb.collection("payments")
      .where("customerId", "==", params.id)
      .orderBy("createdAt", "desc")
      .get();

    const updated = { ...(updatedDoc.data() as any), payments: paymentsSnap.docs.map(d => d.data()) };

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      balance: Number(updated.balance),
      createdAt: updated.createdAt?.toDate ? updated.createdAt.toDate() : updated.createdAt,
      updatedAt: updated.updatedAt?.toDate ? updated.updatedAt.toDate() : updated.updatedAt,
      payments: (updated.payments as any[]).map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        note: p.note,
        billId: p.billId,
        createdAt: p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt,
      })),
    });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to add credit");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
