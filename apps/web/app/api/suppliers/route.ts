import { NextRequest, NextResponse } from "next/server";
import { requireActiveStore } from "../../../lib/tenant";
import { adminDb } from "../../../lib/firebase/server";

export const runtime = "nodejs";

function mapSupplier(s: any) {
  return {
    ...s,
    balance: Number(s.balance || 0),
    createdAt: s.createdAt?.toDate ? s.createdAt.toDate() : s.createdAt,
    updatedAt: s.updatedAt?.toDate ? s.updatedAt.toDate() : s.updatedAt,
    purchases: s.purchases?.map((p: any) => ({
      ...p,
      amount: Number(p.amount),
      createdAt: p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt,
    })) ?? [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.toLowerCase();

    const snapshot = await adminDb.collection("suppliers")
      .where("storeId", "==", tenant.storeId)
      .get();

    let suppliers = snapshot.docs.map(doc => doc.data());

    // Sort in-memory ascending by name
    suppliers.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (q) {
      suppliers = suppliers.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
      );
    }

    // Fetch recent purchases for each supplier
    const suppliersWithPurchases = await Promise.all(
      suppliers.map(async (s) => {
        const purchasesSnap = await adminDb.collection("purchases")
          .where("supplierId", "==", s.id)
          .get();
        let purchases = purchasesSnap.docs.map(d => d.data());
        // Sort in-memory descending by createdAt
        purchases.sort((x, y) => {
          const t1 = x.createdAt?.toDate ? x.createdAt.toDate().getTime() : (x.createdAt ? new Date(x.createdAt).getTime() : 0);
          const t2 = y.createdAt?.toDate ? y.createdAt.toDate().getTime() : (y.createdAt ? new Date(y.createdAt).getTime() : 0);
          return t2 - t1;
        });
        purchases = purchases.slice(0, 10);
        return { ...s, purchases };
      })
    );

    return NextResponse.json(suppliersWithPurchases.map(mapSupplier));
  } catch (error) {
    console.error("GET Suppliers Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const body = await request.json();
    const { name, phone, email, address, balance } = body;

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const supplierRef = adminDb.collection("suppliers").doc();
    const newSupplier = {
      id: supplierRef.id,
      organizationId: tenant.organizationId,
      storeId: tenant.storeId,
      name,
      phone: phone || null,
      email: email || null,
      address: address || null,
      balance: Number(balance || 0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await supplierRef.set(newSupplier);
    return NextResponse.json(mapSupplier({ ...newSupplier, purchases: [] }));
  } catch (error) {
    console.error("POST Supplier Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
