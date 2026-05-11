import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { requireActiveStore } from "../../../../lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireActiveStore();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // 1. Sales by Payment Method
    const bills = await prisma.bill.findMany({
      where: {
        storeId: tenant.storeId,
        createdAt: { gte: today, lt: tomorrow },
        status: "completed"
      },
      select: {
        finalAmount: true,
        paymentMethod: true,
        items: {
          select: {
            quantity: true,
            costPrice: true
          }
        }
      }
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

    bills.forEach(b => {
      const amt = Number(b.finalAmount);
      summary.totalSales += amt;
      const method = b.paymentMethod.toLowerCase();
      if (method === "cash") summary.cash += amt;
      else if (method === "upi") summary.upi += amt;
      else if (method === "card") summary.card += amt;
      else if (method === "credit") summary.credit += amt;

      // Calculate gross profit for this bill
      const cost = b.items.reduce((s, item) => s + (Number(item.quantity) * Number(item.costPrice)), 0);
      summary.grossProfit += (amt - cost);
    });

    // 2. Expenses
    const expenses = await prisma.expense.aggregate({
      where: {
        storeId: tenant.storeId,
        date: { gte: today, lt: tomorrow }
      },
      _sum: { amount: true }
    });

    const totalExpenses = Number(expenses._sum.amount || 0);
    const netProfit = summary.grossProfit - totalExpenses;
    const cashInHand = summary.cash; // Assuming expenses aren't always paid from cash, but for simple POS, it's often the case.
    
    // 3. Top Items
    const topItems = await prisma.billItem.groupBy({
      by: ["productName"],
      where: {
        storeId: tenant.storeId,
        createdAt: { gte: today, lt: tomorrow },
        bill: { status: "completed" }
      },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 3
    });

    return NextResponse.json({
      date: today.toISOString().split("T")[0],
      summary,
      totalExpenses,
      netProfit,
      cashInHand,
      topItems: topItems.map(i => ({ name: i.productName, qty: i._sum.quantity }))
    });
  } catch (error) {
    console.error("Z-Report Error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
