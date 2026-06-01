import { NextRequest, NextResponse } from "next/server";
import { requireActiveStore } from "../../../../lib/tenant";
import { adminDb } from "../../../../lib/firebase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Fetch today's completed bills
    const billsSnap = await adminDb.collection("bills")
      .where("storeId", "==", tenant.storeId)
      .where("status", "==", "completed")
      .get();

    const bills = billsSnap.docs.map(d => d.data()).filter(b => {
      const createdAt = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return createdAt >= today && createdAt < tomorrow;
    });

    const summary = {
      totalSales: 0,
      cash: 0,
      upi: 0,
      card: 0,
      credit: 0,
      grossProfit: 0,
      billCount: bills.length
    };

    const topItemsMap = new Map<string, number>();

    bills.forEach(b => {
      const amt = Number(b.finalAmount);
      summary.totalSales += amt;
      const method = b.paymentMethod?.toLowerCase();
      if (method === "cash") summary.cash += amt;
      else if (method === "upi") summary.upi += amt;
      else if (method === "card") summary.card += amt;
      else if (method === "credit") summary.credit += amt;

      if (b.items && Array.isArray(b.items)) {
        const cost = b.items.reduce((s: number, item: any) => s + (Number(item.quantity) * Number(item.costPrice || 0)), 0);
        summary.grossProfit += (amt - cost);

        b.items.forEach((item: any) => {
          topItemsMap.set(item.productName, (topItemsMap.get(item.productName) || 0) + Number(item.quantity));
        });
      }
    });

    // Today's expenses
    const expensesSnap = await adminDb.collection("expenses")
      .where("storeId", "==", tenant.storeId)
      .get();

    const todayExpenses = expensesSnap.docs.map(d => d.data()).filter(e => {
      const date = e.date?.toDate ? e.date.toDate() : new Date(e.date);
      return date >= today && date < tomorrow;
    });

    const totalExpenses = todayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netProfit = summary.grossProfit - totalExpenses;
    const cashInHand = summary.cash;

    const topItems = Array.from(topItemsMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, qty]) => ({ name, qty }));

    return NextResponse.json({
      date: today.toISOString().split("T")[0],
      summary,
      totalExpenses,
      netProfit,
      cashInHand,
      topItems
    });
  } catch (error) {
    console.error("Z-Report Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
