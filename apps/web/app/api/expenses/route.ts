import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "../../../lib/errors";
import { getTenantErrorStatus, requireActiveStore } from "../../../lib/tenant";
import { adminDb } from "../../../lib/firebase/server";

export const runtime = "nodejs";

const createSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  date: z.string().optional(),
});

function mapExpense(e: any) {
  return {
    ...e,
    amount: Number(e.amount),
    date: e.date?.toDate ? e.date.toDate() : e.date,
    createdAt: e.createdAt?.toDate ? e.createdAt.toDate() : e.createdAt,
    updatedAt: e.updatedAt?.toDate ? e.updatedAt.toDate() : e.updatedAt,
  };
}

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();

    const snapshot = await adminDb.collection("expenses")
      .where("storeId", "==", tenant.storeId)
      .orderBy("date", "desc")
      .limit(100)
      .get();

    return NextResponse.json(snapshot.docs.map(doc => mapExpense(doc.data())));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load expenses");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const body = createSchema.parse(await request.json());

    const expenseRef = adminDb.collection("expenses").doc();
    const newExpense = {
      id: expenseRef.id,
      organizationId: tenant.organizationId,
      storeId: tenant.storeId,
      amount: body.amount,
      category: body.category,
      description: body.description || null,
      date: body.date ? new Date(body.date) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await expenseRef.set(newExpense);
    return NextResponse.json(mapExpense(newExpense), { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to create expense");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
