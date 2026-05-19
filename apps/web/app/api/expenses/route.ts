import { Decimal } from "@prisma/client/runtime/library";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { assertDatabaseConfig } from "../../../lib/database-url";
import { getErrorMessage } from "../../../lib/errors";
import { prisma } from "../../../lib/prisma";
import { getTenantErrorStatus, requireActiveStore } from "../../../lib/tenant";

export const runtime = "nodejs";

const createSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional().nullable(),
  date: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    
    const expenses = await prisma.expense.findMany({
      where: { storeId: tenant.storeId },
      orderBy: { date: "desc" },
      take: 100, // Limit for recent expenses initially
    });

    return NextResponse.json(expenses.map(e => ({
      ...e,
      amount: Number(e.amount),
    })));
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load expenses");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 500) });
  }
}

export async function POST(request: NextRequest) {
  try {
    assertDatabaseConfig();
    const tenant = await requireActiveStore();
    const body = createSchema.parse(await request.json());

    const expense = await prisma.expense.create({
      data: {
        organizationId: tenant.organizationId,
        storeId: tenant.storeId,
        amount: new Decimal(body.amount),
        category: body.category,
        description: body.description || null,
        date: body.date ? new Date(body.date) : new Date(),
      },
    });

    return NextResponse.json({
      ...expense,
      amount: Number(expense.amount),
    }, { status: 201 });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to create expense");
    return NextResponse.json({ message }, { status: getTenantErrorStatus(error, 400) });
  }
}
