import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "../../../../../lib/errors";
import { getTenantErrorStatus, requireActiveStore } from "../../../../../lib/tenant";
import { adminDb } from "../../../../../lib/firebase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().min(1) });

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  method: z.enum(["cash", "upi", "card"]).default("cash"),
  note: z.string().optional(),
  billId: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = paymentSchema.parse(await request.json());

    const customerRef = adminDb.collection("customers").doc(params.id);
    const customerDoc = await customerRef.get();

    if (!customerDoc.exists || customerDoc.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    const currentBalance = Number(customerDoc.data()?.balance || 0);
    if (body.amount > currentBalance) {
      return NextResponse.json(
        { message: `Payment ₹${body.amount} exceeds pending balance ₹${currentBalance.toFixed(2)}` },
        { status: 400 }
      );
    }

    const paymentRef = adminDb.collection("payments").doc();

    await adminDb.runTransaction(async (tx) => {
      tx.set(paymentRef, {
        id: paymentRef.id,
        organizationId: tenant.organizationId,
        storeId: tenant.storeId,
        customerId: params.id,
        billId: body.billId || null,
        amount: body.amount,
        method: body.method,
        note: body.note || null,
        createdAt: new Date()
      });

      tx.update(customerRef, {
        balance: currentBalance - body.amount,
        updatedAt: new Date()
      });

      // Record in ledger as debit (payment received)
      const ledgerRef = adminDb.collection("ledgerEntries").doc();
      tx.set(ledgerRef, {
        id: ledgerRef.id,
        organizationId: tenant.organizationId,
        storeId: tenant.storeId,
        customerId: params.id,
        amount: body.amount,
        type: "debit",
        note: body.note || "Payment received",
        date: new Date(),
        createdAt: new Date()
      });
    });

    const updatedDoc = await customerRef.get();
    const paymentsSnap = await adminDb.collection("payments")
      .where("customerId", "==", params.id)
      .orderBy("createdAt", "desc")
      .get();

    const result = { ...(updatedDoc.data() as any), payments: paymentsSnap.docs.map(d => d.data()) };

    return NextResponse.json({
      id: result.id,
      name: result.name,
      phone: result.phone,
      balance: Number(result.balance),
      createdAt: result.createdAt?.toDate ? result.createdAt.toDate() : result.createdAt,
      updatedAt: result.updatedAt?.toDate ? result.updatedAt.toDate() : result.updatedAt,
      payments: (result.payments as any[]).map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        note: p.note,
        billId: p.billId,
        createdAt: p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt,
      })),
    });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to record payment");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
