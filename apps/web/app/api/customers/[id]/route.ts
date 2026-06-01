import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "../../../../lib/errors";
import { getTenantErrorStatus, requireActiveStore } from "../../../../lib/tenant";
import { adminDb } from "../../../../lib/firebase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().min(1) });

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

async function getCustomerWithPayments(customerId: string) {
  const [customerDoc, paymentsSnap] = await Promise.all([
    adminDb.collection("customers").doc(customerId).get(),
    adminDb.collection("payments")
      .where("customerId", "==", customerId)
      .get()
  ]);
  if (!customerDoc.exists) return null;
  const payments = paymentsSnap.docs.map(d => d.data());
  // Sort in-memory descending by createdAt
  payments.sort((a, b) => {
    const t1 = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const t2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return t2 - t1;
  });
  return { ...(customerDoc.data() as any), payments };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const customer = await getCustomerWithPayments(params.id);

    if (!customer || customer.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(mapCustomer(customer));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load customer");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = updateSchema.parse(await request.json());

    const customerRef = adminDb.collection("customers").doc(params.id);
    const existing = await customerRef.get();

    if (!existing.exists || existing.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    await customerRef.update({ ...body, updatedAt: new Date() });
    const updated = await getCustomerWithPayments(params.id);
    return NextResponse.json(mapCustomer(updated));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to update customer");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);

    const customerRef = adminDb.collection("customers").doc(params.id);
    const existing = await customerRef.get();

    if (!existing.exists || existing.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    await customerRef.delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to delete customer");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}
