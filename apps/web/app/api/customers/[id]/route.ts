import { Decimal } from "@prisma/client/runtime/library";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfig } from "../../../../lib/database-url";
import { getErrorMessage } from "../../../../lib/errors";
import { prisma } from "../../../../lib/prisma";
import { getTenantErrorStatus, requireActiveStore } from "../../../../lib/tenant";

export const runtime = "nodejs";

const paramsSchema = z.object({ id: z.string().min(1) });

function mapCustomer(c: any) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    balance: Number(c.balance),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    payments: c.payments?.map((p: any) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      note: p.note,
      billId: p.billId,
      createdAt: p.createdAt,
    })) ?? [],
  };
}

/* GET /api/customers/[id] */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);

    const customer = await prisma.customer.findFirst({
      where: { id: params.id, storeId: tenant.storeId },
      include: { payments: { orderBy: { createdAt: "desc" } } },
    });

    if (!customer) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    return NextResponse.json(mapCustomer(customer));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load customer");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}

/* PUT /api/customers/[id] — update customer name/phone */
const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);
    const body = updateSchema.parse(await request.json());

    const customer = await prisma.customer.updateMany({
      where: { id: params.id, storeId: tenant.storeId },
      data: body,
    });

    if (customer.count === 0) {
      return NextResponse.json({ message: "Customer not found" }, { status: 404 });
    }

    const updated = await prisma.customer.findFirst({
      where: { id: params.id },
      include: { payments: { orderBy: { createdAt: "desc" } } },
    });

    return NextResponse.json(mapCustomer(updated));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to update customer");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}

/* DELETE /api/customers/[id] */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const params = paramsSchema.parse(await context.params);

    await prisma.customer.deleteMany({
      where: { id: params.id, storeId: tenant.storeId },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to delete customer");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}
