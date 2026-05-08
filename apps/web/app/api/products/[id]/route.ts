import { Decimal } from "@prisma/client/runtime/library";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfig } from "../../../../lib/database-url";
import { getApiErrorStatus, getErrorMessage } from "../../../../lib/errors";
import { prisma } from "../../../../lib/prisma";
import { mapProduct } from "../../../../lib/server-mappers";
import { getTenantErrorStatus, requireActiveStore } from "../../../../lib/tenant";

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
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = updateSchema.parse(await request.json());
    const existing = await prisma.product.findFirst({
      where: {
        id: params.id,
        storeId: tenant.storeId
      }
    });

    if (!existing) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        name: body.name,
        category: body.category === undefined ? undefined : body.category ?? null,
        barcode: body.barcode === undefined ? undefined : body.barcode || null,
        price: body.price === undefined ? undefined : new Decimal(body.price),
        costPrice: body.costPrice === undefined ? undefined : new Decimal(body.costPrice),
        discountPercent:
          body.discountPercent === undefined ? undefined : new Decimal(body.discountPercent),
        taxPercent: body.taxPercent === undefined ? undefined : new Decimal(body.taxPercent),
        stock: body.stock,
        minStock: body.minStock
      }
    });

    return NextResponse.json(mapProduct(product));
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
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const deleted = await prisma.product.deleteMany({
      where: {
        id: params.id,
        storeId: tenant.storeId
      }
    });

    if (deleted.count === 0) {
      return NextResponse.json({ message: "Product not found" }, { status: 404 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to delete product");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, getApiErrorStatus(error, 400)) });
  }
}
