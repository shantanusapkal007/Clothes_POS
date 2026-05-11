import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { requireActiveStore, getTenantErrorStatus } from "../../../lib/tenant";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");

    // Construct common where clause for tenant isolation
    const where: any = {
      storeId: tenant.storeId,
    };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    // 1. Get Aggregated Sales Stats from BillItems
    // This uses SQL-level aggregation for high performance
    const salesStats = await prisma.billItem.groupBy({
      by: ["productId", "productName"],
      where: {
        ...where,
        bill: { status: "completed" }, // Only count completed sales
      },
      _sum: {
        quantity: true,
        total: true,
        // We use the snapshotted costPrice from BillItem for historical accuracy
      },
    });

    // 2. Fetch current product info (stock, minStock) for the UI
    const products = await prisma.product.findMany({
      where: { storeId: tenant.storeId },
      select: {
        id: true,
        stock: true,
        minStock: true,
      },
    });

    const productInfoMap = new Map(products.map(p => [p.id, p]));

    // 3. Calculate Profit per Product
    // Profit = Total Revenue - (Quantity * costPrice)
    // Note: Since BillItem.costPrice is snapshotted, we need to sum (item.quantity * item.costPrice)
    // Prisma's groupBy doesn't support complex arithmetic in _sum yet, so we'll do this part in JS 
    // but only on the AGGREGATED rows (which is much smaller than all bills).
    
    // For high-precision profit, we fetch the individual aggregated totals
    // but since we want "Per Product" stats, we can optimize:
    const detailedProfit = await prisma.billItem.findMany({
      where: {
        ...where,
        bill: { status: "completed" },
      },
      select: {
        productId: true,
        quantity: true,
        costPrice: true,
      }
    });

    const productProfitMap = new Map<string, number>();
    detailedProfit.forEach(item => {
      const cost = Number(item.quantity) * Number(item.costPrice);
      productProfitMap.set(item.productId, (productProfitMap.get(item.productId) || 0) + cost);
    });

    const data = salesStats.map(stat => {
      const info = productInfoMap.get(stat.productId);
      const revenue = Number(stat._sum.total || 0);
      const totalCost = productProfitMap.get(stat.productId) || 0;
      const profit = revenue - totalCost;

      return {
        productId: stat.productId,
        name: stat.productName,
        stock: info?.stock ?? 0,
        minStock: info?.minStock ?? 0,
        totalSold: stat._sum.quantity || 0,
        revenue,
        profit,
      };
    });

    // Sort by revenue descending by default
    data.sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Stats API Error:", error);
    return NextResponse.json(
      { message: "Unable to load statistics" },
      { status: getTenantErrorStatus(error, 500) }
    );
  }
}
