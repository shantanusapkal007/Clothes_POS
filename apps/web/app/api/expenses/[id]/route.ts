import { NextRequest, NextResponse } from "next/server";
import { getErrorMessage } from "../../../../lib/errors";
import { getTenantErrorStatus, requireActiveStore } from "../../../../lib/tenant";
import { adminDb } from "../../../../lib/firebase/server";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveStore();
    const resolvedParams = await params;

    const expenseRef = adminDb.collection("expenses").doc(resolvedParams.id);
    const existing = await expenseRef.get();

    if (!existing.exists || existing.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Expense not found" }, { status: 404 });
    }

    await expenseRef.delete();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to delete expense");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}
