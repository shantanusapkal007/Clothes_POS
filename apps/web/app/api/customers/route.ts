import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "../../../lib/errors";
import { getTenantErrorStatus, requireActiveStore } from "../../../lib/tenant";
import { adminDb } from "../../../lib/firebase/server";

export const runtime = "nodejs";

function mapCustomer(c: any) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    balance: Number(c.balance),
    createdAt: c.createdAt?.toDate ? c.createdAt.toDate() : c.createdAt,
    updatedAt: c.updatedAt?.toDate ? c.updatedAt.toDate() : c.updatedAt,
    payments: c.payments?.map((p: any) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      note: p.note,
      billId: p.billId,
      createdAt: p.createdAt?.toDate ? p.createdAt.toDate() : p.createdAt,
    })) ?? [],
  };
}

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  balance: z.coerce.number().min(0).default(0),
});

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim().toLowerCase() || "";

    const snapshot = await adminDb.collection("customers")
      .where("storeId", "==", tenant.storeId)
      .get();

    let customers = snapshot.docs.map(doc => doc.data());

    // Sort in-memory descending by updatedAt
    customers.sort((a, b) => {
      const t1 = a.updatedAt?.toDate ? a.updatedAt.toDate().getTime() : (a.updatedAt ? new Date(a.updatedAt).getTime() : 0);
      const t2 = b.updatedAt?.toDate ? b.updatedAt.toDate().getTime() : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0);
      return t2 - t1;
    });

    if (search) {
      customers = customers.filter(c =>
        c.name?.toLowerCase().includes(search) ||
        c.phone?.includes(search)
      );
    }

    // Fetch payments for each customer
    const customersWithPayments = await Promise.all(
      customers.map(async (c) => {
        const paymentsSnap = await adminDb.collection("payments")
          .where("customerId", "==", c.id)
          .get();
        let payments = paymentsSnap.docs.map(d => d.data());
        // Sort in-memory descending by createdAt
        payments.sort((x, y) => {
          const t1 = x.createdAt?.toDate ? x.createdAt.toDate().getTime() : (x.createdAt ? new Date(x.createdAt).getTime() : 0);
          const t2 = y.createdAt?.toDate ? y.createdAt.toDate().getTime() : (y.createdAt ? new Date(y.createdAt).getTime() : 0);
          return t2 - t1;
        });
        payments = payments.slice(0, 50);
        return { ...c, payments };
      })
    );

    return NextResponse.json(customersWithPayments.map(mapCustomer));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load customers");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const body = createSchema.parse(await request.json());

    // Check for duplicate phone
    const existing = await adminDb.collection("customers")
      .where("storeId", "==", tenant.storeId)
      .where("phone", "==", body.phone)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ message: "Customer with this phone already exists" }, { status: 409 });
    }

    const customerRef = adminDb.collection("customers").doc();
    const newCustomer = {
      id: customerRef.id,
      organizationId: tenant.organizationId,
      storeId: tenant.storeId,
      name: body.name,
      phone: body.phone,
      balance: body.balance,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await customerRef.set(newCustomer);
    return NextResponse.json(mapCustomer({ ...newCustomer, payments: [] }), { status: 201 });
  } catch (error: any) {
    const message = getErrorMessage(error, "Unable to create customer");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
