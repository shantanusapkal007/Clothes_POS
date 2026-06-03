"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getBills, refundBill, getStats, type BillsListResponse } from "../../lib/api";
import {
  getBillLayoutConfig,
  getPrinterConfig,
  printReceipt,
  type PrintableBillData,
  hydrateSerialPort,
  requestSerialPrinter,
  savePrinterConfig
} from "../../lib/printer";
import type { BillResponse } from "../../types";

type DateFilter = "today" | "week" | "month" | "all";

function getDateRange(filter: DateFilter) {
  const now = new Date();
  switch (filter) {
    case "today": {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString().split("T")[0] };
    }
    case "week": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString().split("T")[0] };
    }
    case "month": {
      const from = new Date(now);
      from.setMonth(from.getMonth() - 1);
      return { from: from.toISOString().split("T")[0] };
    }
    default:
      return {};
  }
}

function formatBillDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function statusBadge(status: string) {
  switch (status) {
    case "refunded":
      return { label: "Refunded", cls: "bg-red-100 text-red-700" };
    default:
      return { label: "Completed", cls: "bg-emerald-100 text-emerald-700" };
  }
}

function paymentIcon(method: string) {
  switch (method.toLowerCase()) {
    case "card":
      return "credit_card";
    case "upi":
      return "qr_code_2";
    default:
      return "payments";
  }
}

export default function ReportsPage() {
  const [data, setData] = useState<BillsListResponse | null>(null);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [page, setPage] = useState(1);
  const [selectedBill, setSelectedBill] = useState<BillResponse | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState(false);
  const [activeTab, setActiveTab] = useState<"sales" | "inventory">("sales");

  const loadBills = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const range = getDateRange(dateFilter);
      const result = await getBills({
        page,
        limit: 20,
        search: search.trim() || undefined,
        ...range,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load bills");
    } finally {
      setLoading(false);
    }
  }, [page, search, dateFilter]);

  const loadStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await getStats({
        from: getDateRange(dateFilter).from || undefined,
      });
      setStats(res.items || []);
      setTotalExpenses(res.summary?.totalExpenses || 0);
    } catch {
      // ignore
    } finally {
      setStatsLoading(false);
    }
  }, [dateFilter]);

  const [totalExpenses, setTotalExpenses] = useState(0);

  useEffect(() => {
    void loadBills();
  }, [loadBills]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const handleRefund = async (bill: BillResponse) => {
    if (bill.status === "refunded") return;
    const reason = prompt("Refund reason (optional):");
    if (reason === null) return;

    try {
      setRefunding(true);
      const updated = await refundBill(bill.id, reason || undefined);
      setSelectedBill(updated);
      setMessage("Bill refunded \u2014 stock restored");
      await loadBills();
      await loadStats();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  };

  const handleReprint = async (bill: BillResponse) => {
    try {
      setReprinting(true);
      const layout = getBillLayoutConfig();
      let config = getPrinterConfig();

      if (config.connectionType === "serial") {
        try {
          const port = await hydrateSerialPort(config);
          if (port) {
            if (!config.connected) {
              config = {
                ...config,
                connected: true
              };
              savePrinterConfig(config);
            }
          } else {
            const printer = await requestSerialPrinter(config.serialBaudRate ?? 9600);
            if (printer) {
              config = {
                ...config,
                ...printer,
                connected: true
              };
              savePrinterConfig(config);
            } else {
              setMessage("Serial printer not connected.");
              setReprinting(false);
              return;
            }
          }
        } catch (err) {
          console.error("Failed to connect serial printer:", err);
        }
      }

      const printData: PrintableBillData = {
        items: bill.items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
          total: i.total,
          discountPercent: 0,
          taxPercent: 0,
          costPrice: 0
        })),
        totalAmount: bill.totalAmount,
        discountAmount: bill.discountAmount,
        taxAmount: bill.taxAmount,
        finalAmount: bill.finalAmount,
        paymentMethod: bill.paymentMethod,
        createdAt: bill.createdAt,
      };
      const billNum = bill.id.slice(0, 8).toUpperCase();
      const route = await printReceipt(printData, billNum, config, layout);
      setMessage(
        route === "device"
          ? "Sent to printer"
          : route === "browser"
            ? "Print preview opened"
            : "Print failed \u2014 check connection"
      );
    } catch {
      setMessage("Print failed");
    } finally {
      setReprinting(false);
    }
  };

  const salesStats = useMemo(() => {
    if (!data?.bills) return { count: 0, total: 0, profit: 0, netProfit: 0 };
    const bills = data.bills.filter((b) => b.status !== "refunded");
    const total = bills.reduce((s, b) => s + b.finalAmount, 0);
    
    // Total profit from inventory stats
    const totalGrossProfit = stats.reduce((s, item) => s + (item.profit || 0), 0);

    return {
      count: bills.length,
      total: total,
      profit: totalGrossProfit,
      netProfit: totalGrossProfit - totalExpenses
    };
  }, [data, stats, totalExpenses]);

  const DATE_FILTERS: { key: DateFilter; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "7 Days" },
    { key: "month", label: "30 Days" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="main-content app-shell">
      <div className="mx-auto max-w-4xl px-3 py-4 pb-24 md:px-6 md:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-secondary-container">Business Insights</span>
            <h1 className="text-2xl font-bold text-on-background md:text-3xl">Reports & Dashboard</h1>
          </div>
          <button
            onClick={async () => {
              try {
                const res = await fetch("/api/stats/closing");
                const report = await res.json();
                const text = `*Z-REPORT: ${report.date}*%0A%0A` +
                  `*Sales Summary:*%0A` +
                  `Total: ₹${report.summary.totalSales}%0A` +
                  `Cash: ₹${report.summary.cash}%0A` +
                  `UPI: ₹${report.summary.upi}%0A` +
                  `Card: ₹${report.summary.card}%0A` +
                  `Udhar: ₹${report.summary.credit}%0A%0A` +
                  `*Profit/Loss:*%0A` +
                  `Expenses: ₹${report.totalExpenses}%0A` +
                  `Net Profit: ₹${report.netProfit}%0A%0A` +
                  `*Top Items:*%0A` +
                  report.topItems.map((i: any) => `• ${i.name} (${i.qty})`).join("%0A");
                
                window.open(`https://wa.me/?text=${text}`, "_blank");
              } catch {
                setMessage("Failed to generate Z-Report");
              }
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-lg transition active:scale-95"
          >
            <span className="material-symbols-outlined text-lg">summarize</span>
          </button>
        </div>

        {/* Top Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container/60">Total Sales</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-on-surface">₹{salesStats.total.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-2xl border border-rose-100 bg-rose-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Expenses</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-rose-800">₹{totalExpenses.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Net Profit</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-800">₹{salesStats.netProfit.toLocaleString("en-IN")}</p>
          </div>
          <div className="rounded-2xl border border-outline-variant/30 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container/60">Bills Count</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-on-surface">{salesStats.count}</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mb-6 flex gap-2 border-b border-outline-variant/20 pb-0">
          <button
            onClick={() => setActiveTab("sales")}
            className={`px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "sales" ? "border-b-2 border-primary text-primary" : "text-on-secondary-container"
            }`}
          >
            Sales & Bills
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`px-4 py-2 text-sm font-bold transition-all ${
              activeTab === "inventory" ? "border-b-2 border-primary text-primary" : "text-on-secondary-container"
            }`}
          >
            Inventory Stats
          </button>
        </div>

        {activeTab === "sales" ? (
          <div className="space-y-6">
            {/* Sales Filters */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {DATE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setDateFilter(f.key); setPage(1); }}
                    className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold transition ${
                      dateFilter === f.key ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-white border border-outline-variant/50 text-on-secondary-container"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-secondary-container/50" style={{ fontSize: 18 }}>search</span>
                <input
                  className="w-full rounded-xl border border-outline-variant/40 bg-white py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Search bills..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </div>

            {/* Bills List */}
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-container-high/40" />
                ))}
              </div>
            ) : !data?.bills.length ? (
              <div className="py-20 text-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">receipt_long</span>
                <p className="mt-2 text-sm text-on-secondary-container">No sales records found for this period.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {data.bills.map((bill) => {
                  const badge = statusBadge(bill.status);
                  return (
                    <motion.button
                      key={bill.id}
                      onClick={() => setSelectedBill(bill)}
                      className="group flex items-center gap-4 rounded-2xl border border-outline-variant/30 bg-white p-4 text-left shadow-sm transition hover:bg-surface-container-lowest active:scale-[0.99]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high group-hover:bg-primary/5 transition-colors">
                        <span className="material-symbols-outlined text-on-secondary-container group-hover:text-primary transition-colors" style={{ fontSize: 20 }}>
                          {paymentIcon(bill.paymentMethod)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-on-surface">#{bill.id.slice(0, 8).toUpperCase()}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>{badge.label}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-on-secondary-container/70">
                          {formatBillDate(bill.createdAt)} {bill.customerName ? `\u2022 ${bill.customerName}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold tabular-nums ${bill.status === "refunded" ? "text-red-400 line-through" : "text-on-surface"}`}>
                          \u20b9{bill.finalAmount.toFixed(0)}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container/50">{bill.paymentMethod}</p>
                      </div>
                      <span className="material-symbols-outlined text-on-secondary-container/30 group-hover:text-primary/50 transition-colors" style={{ fontSize: 18 }}>chevron_right</span>
                    </motion.button>
                  );
                })}

                {/* Pagination */}
                {data.pages > 1 && (
                  <div className="flex items-center justify-center gap-4 pt-4">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      className="rounded-xl border border-outline-variant/40 bg-white px-4 py-2 text-xs font-bold disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold text-on-secondary-container">{page} / {data.pages}</span>
                    <button
                      disabled={page >= data.pages}
                      onClick={() => setPage(p => p + 1)}
                      className="rounded-xl border border-outline-variant/40 bg-white px-4 py-2 text-xs font-bold disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
             {/* Inventory Stats */}
             {statsLoading ? (
               <div className="grid gap-3">
                 {Array.from({ length: 8 }).map((_, i) => (
                   <div key={i} className="h-14 animate-pulse rounded-2xl bg-surface-container-high/40" />
                 ))}
               </div>
             ) : !stats.length ? (
               <div className="py-20 text-center">
                 <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">inventory_2</span>
                 <p className="mt-2 text-sm text-on-secondary-container">No inventory data available yet.</p>
               </div>
             ) : (
               <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-sm">
                 <div className="overflow-x-auto">
                   <table className="w-full border-collapse text-left text-sm">
                     <thead>
                       <tr className="border-b border-outline-variant/20 bg-surface-container-lowest text-[10px] font-bold uppercase tracking-widest text-on-secondary-container/60">
                         <th className="px-6 py-4">Product Name</th>
                         <th className="px-6 py-4 text-center">Stock</th>
                         <th className="px-6 py-4 text-center">Sold</th>
                         <th className="px-6 py-4 text-right">Revenue</th>
                         <th className="px-6 py-4 text-right text-emerald-700">Profit</th>
                         <th className="px-6 py-4 text-right">Margin</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-outline-variant/10">
                       {stats.map((s) => {
                         const margin = s.revenue > 0 ? (s.profit / s.revenue) * 100 : 0;
                         return (
                           <tr key={s.productId} className="hover:bg-surface-container-low/30 transition-colors">
                             <td className="px-6 py-4 font-medium text-on-surface">{s.name}</td>
                             <td className="px-6 py-4 text-center">
                               <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${s.stock < s.minStock ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-emerald-50 text-emerald-700"}`}>
                                 {s.stock}
                               </span>
                             </td>
                             <td className="px-6 py-4 text-center tabular-nums">{s.totalSold}</td>
                             <td className="px-6 py-4 text-right font-medium tabular-nums text-on-surface">₹{Number(s.revenue || 0).toLocaleString("en-IN")}</td>
                             <td className="px-6 py-4 text-right font-bold tabular-nums text-emerald-700">₹{Number(s.profit || 0).toLocaleString("en-IN")}</td>
                             <td className={`px-6 py-4 text-right font-bold tabular-nums ${margin > 0 ? "text-emerald-600" : "text-red-500"}`}>
                               {margin.toFixed(0)}%
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                   </table>
                 </div>
               </div>
             )}
          </div>
        )}

        {/* Message Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-2xl"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bill Detail Modal (Bottom Sheet) */}
        <AnimatePresence>
          {selectedBill && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-md"
                onClick={() => setSelectedBill(null)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 32, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-[101] max-h-[90vh] overflow-hidden rounded-t-[2.5rem] bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.2)] md:inset-x-auto md:left-1/2 md:w-[480px] md:-translate-x-1/2"
              >
                <div className="flex h-full flex-col p-6 pt-2">
                  <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-outline-variant/30" />
                  
                  <div className="mb-6 flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-serif text-on-surface">Bill Details</h2>
                      <p className="text-xs font-bold tracking-widest text-on-secondary-container/50 uppercase">#{selectedBill.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                    <button onClick={() => setSelectedBill(null)} className="rounded-full bg-surface-container-high p-2 text-on-surface transition active:scale-90">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-6 pr-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-surface-container-low p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container/60">Date & Time</p>
                        <p className="mt-1 text-xs font-bold text-on-surface">{formatBillDate(selectedBill.createdAt)}</p>
                      </div>
                      <div className="rounded-2xl bg-surface-container-low p-4">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container/60">Payment Method</p>
                        <p className="mt-1 text-xs font-bold text-on-surface uppercase">{selectedBill.paymentMethod}</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-outline-variant/30 p-4">
                      <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-on-secondary-container/50">Purchased Items</p>
                      <div className="space-y-3">
                        {selectedBill.items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <div className="flex-1">
                              <p className="font-bold text-on-surface">{item.productName}</p>
                              <p className="text-[11px] text-on-secondary-container/60">{item.quantity} \u00d7 \u20b9{item.price.toFixed(0)}</p>
                            </div>
                            <span className="font-bold tabular-nums text-on-surface">\u20b9{item.total.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-6 space-y-1.5 border-t border-outline-variant/20 pt-4">
                        <div className="flex justify-between text-xs text-on-secondary-container">
                          <span>Subtotal</span>
                          <span className="tabular-nums font-bold">\u20b9{selectedBill.totalAmount.toFixed(2)}</span>
                        </div>
                        {selectedBill.discountAmount > 0 && (
                          <div className="flex justify-between text-xs text-emerald-600">
                            <span>Discount</span>
                            <span className="tabular-nums font-bold">-\u20b9{selectedBill.discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-bold text-primary pt-1">
                          <span>Grand Total</span>
                          <span className="tabular-nums">\u20b9{selectedBill.finalAmount.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3 pb-4">
                    <button
                      onClick={() => handleReprint(selectedBill)}
                      disabled={reprinting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-bold text-white shadow-lg shadow-primary/20 transition active:scale-95 disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-lg">{reprinting ? "sync" : "print"}</span>
                      {reprinting ? "Printing\u2026" : "Reprint Receipt"}
                    </button>
                    {selectedBill.status !== "refunded" && (
                      <button
                        onClick={() => handleRefund(selectedBill)}
                        disabled={refunding}
                        className="flex items-center justify-center rounded-2xl border-2 border-red-100 bg-white px-6 text-red-600 transition active:scale-95 disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined">{refunding ? "sync" : "undo"}</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
