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
    const products = await prisma.product.findMany({
      select: { id: true, name: true, stock: true, minStock: true, price: true, costPrice: true },
    });
    const data = products.map(p => {
      const soldEntry = sold.find(s => s.productId === p.id);
      const unitsSold = Number(soldEntry?._sum?.quantity ?? 0);
      const revenue = unitsSold * Number(p.price);
      const profit = unitsSold * (Number(p.price) - Number(p.costPrice));

      return {
        productId: p.id,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        totalSold: unitsSold,
        revenue,
        profit,
      };
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = getErrorMessage(error, "Unable to load stats");
    return NextResponse.json({ message }, { status: getApiErrorStatus(error, 500) });
  }
}
