import { Decimal } from "@prisma/client/runtime/library";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfig } from "../../../lib/database-url";
import { getErrorMessage } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { getTenantErrorStatus, requireActiveStore } from "../../../lib/tenant";

export const runtime = "nodejs";

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

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  balance: z.coerce.number().min(0).default(0),
});

/* GET /api/customers — list all customers for this store */
export async function GET(request: NextRequest) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || "";

    const where: any = { storeId: tenant.storeId };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: { payments: { orderBy: { createdAt: "desc" }, take: 50 } },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(customers.map(mapCustomer));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load customers");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}

/* POST /api/customers — create a new customer */
export async function POST(request: NextRequest) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const body = createSchema.parse(await request.json());

    const customer = await prisma.customer.create({
      data: {
        organizationId: tenant.organizationId,
        storeId: tenant.storeId,
        name: body.name,
        phone: body.phone,
        balance: new Decimal(body.balance),
      },
      include: { payments: true },
    });

    return NextResponse.json(mapCustomer(customer), { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ message: "Customer with this phone already exists" }, { status: 409 });
    }
    const message = getErrorMessage(error, "Unable to create customer");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
