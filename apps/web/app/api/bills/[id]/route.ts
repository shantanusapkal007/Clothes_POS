import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "../../../../lib/errors";
import { mapBill } from "../../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../../lib/tenant";
import { adminDb } from "../../../../lib/firebase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().min(1)
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);

    const billDoc = await adminDb.collection("bills").doc(params.id).get();

    if (!billDoc.exists || billDoc.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Bill not found" }, { status: 404 });
    }

    return NextResponse.json(mapBill(billDoc.data()));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load bill");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}
