import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "../../../../../lib/errors";
import { mapProduct } from "../../../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../../../lib/tenant";
import { adminDb } from "../../../../../lib/firebase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({
  code: z.string().min(1)
});

export async function GET(
  _request: NextRequest,
  context: {
    params: Promise<{ code: string }>;
  }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    
    const query = await adminDb.collection("products")
      .where("storeId", "==", tenant.storeId)
      .where("barcode", "==", params.code)
      .limit(1)
      .get();

    if (query.empty) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    const doc = query.docs[0];
    return NextResponse.json(mapProduct({ id: doc.id, ...doc.data() }));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load product");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}
