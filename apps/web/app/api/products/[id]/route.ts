import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiErrorStatus, getErrorMessage } from "../../../../lib/errors";
import { mapProduct } from "../../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../../lib/tenant";
import { adminDb } from "../../../../lib/firebase/server";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().min(1)
});

const updateSchema = z
  .object({
    name: z.string().min(1).optional(),
    category: z.string().trim().optional().nullable(),
    barcode: z.string().trim().optional().nullable(),
    price: z.coerce.number().min(0).optional(),
    costPrice: z.coerce.number().min(0).optional(),
    discountPercent: z.coerce.number().min(0).optional(),
    taxPercent: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().int().min(0).optional(),
    minStock: z.coerce.number().int().min(0).optional()
  })
  .strict();

export async function PUT(
  request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = updateSchema.parse(await request.json());
    
    const productRef = adminDb.collection("products").doc(params.id);
    const existingDoc = await productRef.get();

    if (!existingDoc.exists || existingDoc.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    const updates: Record<string, any> = { updatedAt: new Date() };
    
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category ?? null;
    if (body.barcode !== undefined) updates.barcode = body.barcode || null;
    if (body.price !== undefined) updates.price = body.price;
    if (body.costPrice !== undefined) updates.costPrice = body.costPrice;
    if (body.discountPercent !== undefined) updates.discountPercent = body.discountPercent;
    if (body.taxPercent !== undefined) updates.taxPercent = body.taxPercent;
    if (body.stock !== undefined) updates.stock = body.stock;
    if (body.minStock !== undefined) updates.minStock = body.minStock;

    await productRef.update(updates);
    const updatedDoc = await productRef.get();

    return NextResponse.json(mapProduct({ id: updatedDoc.id, ...updatedDoc.data() }));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to update product");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, getApiErrorStatus(error, 400)) });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    
    const productRef = adminDb.collection("products").doc(params.id);
    const existingDoc = await productRef.get();

    if (!existingDoc.exists || existingDoc.data()?.storeId !== tenant.storeId) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    await productRef.delete();

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to delete product");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, getApiErrorStatus(error, 400)) });
  }
}
