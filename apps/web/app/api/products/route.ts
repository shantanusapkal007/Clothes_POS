import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getApiErrorStatus, getErrorMessage } from "../../../lib/errors";
import { mapProduct } from "../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../lib/tenant";
import { adminDb } from "../../../lib/firebase/server";

export const runtime = "nodejs";

const productSchema = z.object({
  name: z.string().min(1),
  category: z.string().trim().optional().nullable(),
  barcode: z.string().trim().optional().nullable(),
  price: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).default(0),
  discountPercent: z.coerce.number().min(0).default(0),
  taxPercent: z.coerce.number().min(0).default(0),
  stock: z.coerce.number().int().min(0).default(0),
  minStock: z.coerce.number().int().min(0).default(0)
});

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const search = request.nextUrl.searchParams.get("search")?.trim().toLowerCase();

    // Note: Firestore doesn't support complex OR queries with full text search or skip/take pagination easily.
    // For this migration, we fetch the products for the store, sort them, and filter in-memory if there is a search term.
    
    let query = adminDb.collection("products").where("storeId", "==", tenant.storeId);
    
    const snapshot = await query.get();
    let products = snapshot.docs.map(doc => doc.data());
    
    products.sort((a, b) => b.updatedAt?.toDate() - a.updatedAt?.toDate());

    if (search) {
      products = products.filter(p => 
        (p.name?.toLowerCase().includes(search)) ||
        (p.category?.toLowerCase().includes(search)) ||
        (p.barcode?.toLowerCase().includes(search))
      );
    }

    const page = parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10);
    const pageSize = parseInt(request.nextUrl.searchParams.get("pageSize") ?? "20", 10);
    const skip = (page - 1) * pageSize;
    
    const totalCount = products.length;
    const paginatedProducts = products.slice(skip, skip + pageSize);

    return NextResponse.json({ items: paginatedProducts.map(mapProduct), totalCount });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load products");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const body = productSchema.parse(await request.json());
    
    const productRef = adminDb.collection("products").doc();
    const newProduct = {
      id: productRef.id,
      organizationId: tenant.organizationId,
      storeId: tenant.storeId,
      name: body.name,
      category: body.category ?? null,
      barcode: body.barcode || null,
      price: body.price,
      costPrice: body.costPrice,
      discountPercent: body.discountPercent,
      taxPercent: body.taxPercent,
      stock: body.stock,
      minStock: body.minStock,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await productRef.set(newProduct);

    return NextResponse.json(mapProduct(newProduct), { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to create product");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, getApiErrorStatus(error, 400)) });
  }
}
