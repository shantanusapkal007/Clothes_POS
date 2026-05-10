import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getApiErrorStatus, getErrorMessage } from "../../../lib/errors";

export async function GET(request: NextRequest) {
  try {
    // Aggregate total quantity sold per product and total purchase (stock change)
    const sold = await prisma.billItem.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
    });
    const purchases = await prisma.product.findMany({
      select: { id: true, stock: true, minStock: true, name: true },
    });
    const data = purchases.map(p => {
      const soldEntry = sold.find(s => s.productId === p.id);
      return {
        productId: p.id,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        totalSold: soldEntry?._sum?.quantity ?? 0,
      };
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load stats");
    return NextResponse.json({ message }, { status: getApiErrorStatus(error, 500) });
  }
}
