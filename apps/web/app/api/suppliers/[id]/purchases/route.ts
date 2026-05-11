import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { requireActiveStore } from "../../../../../lib/tenant";
import { Decimal } from "@prisma/client/runtime/library";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenant = await requireActiveStore();
    const resolvedParams = await params;

    const supplierId = resolvedParams.id;
    const body = await request.json();
    const { amount, note } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // Use a transaction to create purchase and update supplier balance
    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          organizationId: tenant.organizationId,
          storeId: tenant.storeId,
          supplierId,
          amount: new Decimal(amount),
          note
        }
      });

      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          balance: {
            increment: new Decimal(amount)
          }
        }
      });

      return p;
    });

    return NextResponse.json(purchase);
  } catch (error) {
    console.error("POST Purchase Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
