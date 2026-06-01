import { NextRequest, NextResponse } from "next/server";
import { requireActiveStore, getTenantErrorStatus } from "../../../lib/tenant";
import { adminDb } from "../../../lib/firebase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");

    // Fetch all completed bills for the store, applying date filter in-memory
    let billsQuery = adminDb.collection("bills")
      .where("storeId", "==", tenant.storeId)
      .where("status", "==", "completed");

    const billsSnap = await billsQuery.get();
    let bills = billsSnap.docs.map(d => d.data());

    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? (() => { const d = new Date(dateTo); d.setHours(23,59,59,999); return d; })() : null;
      bills = bills.filter(b => {
        const createdAt = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        if (fromDate && createdAt < fromDate) return false;
        if (toDate && createdAt > toDate) return false;
        return true;
      });
    }

    // Aggregate per product from bill items
    const productStatsMap = new Map<string, { name: string; revenue: number; totalCost: number; totalSold: number }>();

    for (const bill of bills) {
      if (!bill.items || !Array.isArray(bill.items)) continue;
      for (const item of bill.items) {
        const existing = productStatsMap.get(item.productId) || { name: item.productName, revenue: 0, totalCost: 0, totalSold: 0 };
        existing.revenue += Number(item.total);
        existing.totalCost += Number(item.quantity) * Number(item.costPrice || 0);
        existing.totalSold += Number(item.quantity);
        productStatsMap.set(item.productId, existing);
      }
    }

    // Fetch current product stock
    const productsSnap = await adminDb.collection("products").where("storeId", "==", tenant.storeId).get();
    const productInfoMap = new Map(productsSnap.docs.map(d => [d.id, d.data()]));

    const data = Array.from(productStatsMap.entries()).map(([productId, stats]) => {
      const info = productInfoMap.get(productId);
      return {
        productId,
        name: stats.name,
        stock: info?.stock ?? 0,
        minStock: info?.minStock ?? 0,
        totalSold: stats.totalSold,
        revenue: stats.revenue,
        profit: stats.revenue - stats.totalCost,
      };
    });

    // Expenses aggregation
    let expensesQuery = adminDb.collection("expenses").where("storeId", "==", tenant.storeId);
    const expensesSnap = await expensesQuery.get();
    let expenses = expensesSnap.docs.map(d => d.data());

    if (dateFrom || dateTo) {
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? (() => { const d = new Date(dateTo); d.setHours(23,59,59,999); return d; })() : null;
      expenses = expenses.filter(e => {
        const date = e.date?.toDate ? e.date.toDate() : new Date(e.date);
        if (fromDate && date < fromDate) return false;
        if (toDate && date > toDate) return false;
        return true;
      });
    }

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    data.sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      items: data,
      summary: { totalExpenses }
    });
  } catch (error) {
    console.error("Stats API Error:", error);
    return NextResponse.json(
      { message: "Unable to load statistics" },
      { status: getTenantErrorStatus(error, 500) }
    );
  }
}
