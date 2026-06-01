import { NextRequest, NextResponse } from "next/server";
import { requireActiveStore } from "../../../../../lib/tenant";
import { adminDb } from "../../../../../lib/firebase/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requireActiveStore();
    const resolvedParams = await params;
    const supplierId = resolvedParams.id;
    const body = await request.json();
    const { amount, note } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const supplierRef = adminDb.collection("suppliers").doc(supplierId);
    const supplierDoc = await supplierRef.get();

    if (!supplierDoc.exists || supplierDoc.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const currentBalance = Number(supplierDoc.data()?.balance || 0);
    const purchaseRef = adminDb.collection("purchases").doc();
    const newPurchase = {
      id: purchaseRef.id,
      organizationId: tenant.organizationId,
      storeId: tenant.storeId,
      supplierId,
      amount: Number(amount),
      status: "completed",
      note: note || null,
      createdAt: new Date(),
    };

    await adminDb.runTransaction(async (tx) => {
      tx.set(purchaseRef, newPurchase);
      tx.update(supplierRef, {
        balance: currentBalance + Number(amount),
        updatedAt: new Date()
      });
    });

    return NextResponse.json({ ...newPurchase, amount: Number(newPurchase.amount) });
  } catch (error) {
    console.error("POST Purchase Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
