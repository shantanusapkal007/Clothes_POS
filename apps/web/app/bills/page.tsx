"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";
import { getBills, refundBill, type BillsListResponse } from "../../lib/api";
import {
  buildReceiptText,
  getBillLayoutConfig,
  getPrinterConfig,
  printReceipt,
  type PrintableBillData,
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

export default function BillsPage() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [page, setPage] = useState(1);
  const [selectedBill, setSelectedBill] = useState<BillResponse | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState(false);

  const range = useMemo(() => getDateRange(dateFilter), [dateFilter]);
  const swrKey = `/api/bills?page=${page}&search=${search.trim()}&from=${range.from || ""}`;

  const { data, error: swrError, isLoading, mutate } = useSWR<BillsListResponse>(
    swrKey,
    () =>
      getBills({
        page,
        limit: 20,
        search: search.trim() || undefined,
        ...range,
      }),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const loading = isLoading;
  const error = swrError ? (swrError instanceof Error ? swrError.message : "Failed to load bills") : null;

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const handleRefund = async (bill: BillResponse) => {
    if (bill.status === "refunded") return;
    const reason = prompt("Refund reason (optional):");
    if (reason === null) return; // cancelled

    try {
      setRefunding(true);
      const updated = await refundBill(bill.id, reason || undefined);
      setSelectedBill(updated);
      setMessage("Bill refunded — stock restored");
      void mutate();
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
      const config = getPrinterConfig();
      const printData: PrintableBillData = {
        items: bill.items.map((i) => ({
          productName: i.productName,
          quantity: i.quantity,
          price: i.price,
          total: i.total,
          discountPercent: 0,
          taxPercent: 0,
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
            : "Print failed — check connection"
      );
    } catch {
      setMessage("Print failed");
    } finally {
      setReprinting(false);
    }
  };

  const todaySales = useMemo(() => {
    if (!data?.bills) return { count: 0, total: 0 };
    const today = new Date().toDateString();
    const todayBills = data.bills.filter(
      (b) => new Date(b.createdAt).toDateString() === today && b.status !== "refunded"
    );
    return {
      count: todayBills.length,
      total: todayBills.reduce((s, b) => s + b.finalAmount, 0),
    };
  }, [data]);

  const DATE_FILTERS: { key: DateFilter; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "7 Days" },
    { key: "month", label: "30 Days" },
    { key: "all", label: "All" },
  ];

  return (
    <div className="main-content app-shell">
      <div className="mx-auto max-w-3xl px-3 py-4 pb-24 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-xl font-bold text-on-surface md:text-2xl">Bill History</h1>
          <p className="mt-0.5 text-xs text-on-secondary-container">
            View, reprint, and refund past bills
          </p>
        </div>

        {/* Stats Strip */}
        <div className="mb-4 flex gap-2">
          <div className="flex-1 rounded-xl border border-outline-variant/30 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">
              Bills
            </p>
            <p className="text-lg font-bold text-on-surface tabular-nums">
              {data?.total ?? "—"}
            </p>
          </div>
          <div className="flex-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Today&apos;s Sales
            </p>
            <p className="text-lg font-bold text-emerald-800 tabular-nums">
              ₹{todaySales.total.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Search + Date Filter */}
        <div className="mb-3 space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5">
            <span className="material-symbols-outlined text-on-secondary-container/50" style={{ fontSize: 18 }}>
              search
            </span>
            <input
              className="flex-1 border-none bg-transparent text-sm text-on-surface placeholder:text-on-secondary-container/50 focus:outline-none focus:ring-0"
              placeholder="Search by bill ID or customer..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              style={{ fontSize: 16 }}
            />
          </div>
          <div className="flex gap-1.5">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => {
                  setDateFilter(f.key);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  dateFilter === f.key
                    ? "bg-primary text-white"
                    : "bg-surface-container-high text-on-secondary-container"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Message Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-800"
            >
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bills List */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-container-high/50" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button
              onClick={() => void mutate()}
              className="mt-2 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700"
            >
              Retry
            </button>
          </div>
        ) : !data?.bills.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-on-surface-variant/30">
              receipt_long
            </span>
            <p className="text-sm font-medium text-on-surface">No bills found</p>
            <p className="mt-0.5 text-xs text-on-secondary-container">
              {search ? "Try a different search" : "Bills will appear here after checkout"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.bills.map((bill) => {
              const badge = statusBadge(bill.status);
              return (
                <motion.button
                  key={bill.id}
                  type="button"
                  onClick={() => setSelectedBill(bill)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex w-full items-center gap-3 rounded-xl border border-outline-variant/30 bg-white p-3 text-left shadow-sm transition active:scale-[0.99] md:p-4"
                >
                  {/* Payment icon */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-container-high/60">
                    <span className="material-symbols-outlined text-on-secondary-container" style={{ fontSize: 20 }}>
                      {paymentIcon(bill.paymentMethod)}
                    </span>
                  </div>

                  {/* Bill info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-on-surface tabular-nums">
                        #{bill.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-on-secondary-container">
                      {formatBillDate(bill.createdAt)}
                      {bill.customerName ? ` • ${bill.customerName}` : ""}
                    </p>
                  </div>

                  {/* Amount */}
                  <div className="shrink-0 text-right">
                    <p className={`text-base font-bold tabular-nums ${bill.status === "refunded" ? "text-red-500 line-through" : "text-primary"}`}>
                      ₹{bill.finalAmount.toFixed(0)}
                    </p>
                    <p className="text-[10px] font-medium uppercase text-on-secondary-container/60">
                      {bill.paymentMethod}
                    </p>
                  </div>

                  <span className="material-symbols-outlined text-on-secondary-container/30" style={{ fontSize: 18 }}>
                    chevron_right
                  </span>
                </motion.button>
              );
            })}

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-bold text-on-secondary-container disabled:opacity-30"
                >
                  Prev
                </button>
                <span className="text-xs text-on-secondary-container tabular-nums">
                  {page} / {data.pages}
                </span>
                <button
                  disabled={page >= data.pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-bold text-on-secondary-container disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── Bill Detail Bottom Sheet ─── */}
        <AnimatePresence>
          {selectedBill && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                onClick={() => setSelectedBill(null)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-[101] max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.15)]"
                style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
              >
                {/* Drag handle */}
                <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-outline-variant/30" />

                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-2 pt-1">
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">
                      Bill #{selectedBill.id.slice(0, 8).toUpperCase()}
                    </h2>
                    <p className="text-[11px] text-on-secondary-container">
                      {formatBillDate(selectedBill.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedBill(null)}
                    className="material-symbols-outlined rounded-lg p-1.5 text-on-secondary-container transition hover:text-on-surface"
                    style={{ fontSize: 22 }}
                  >
                    close
                  </button>
                </div>

                {/* Status + Payment */}
                <div className="mx-4 mb-3 flex gap-2">
                  {(() => {
                    const badge = statusBadge(selectedBill.status);
                    return (
                      <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${badge.cls}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
                  <span className="rounded-md bg-surface-container-high px-2 py-1 text-[10px] font-bold text-on-secondary-container">
                    {selectedBill.paymentMethod.toUpperCase()}
                  </span>
                  {selectedBill.customerName && (
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                      {selectedBill.customerName}
                    </span>
                  )}
                </div>

                {/* Items */}
                <div className="mx-4 mb-3 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-on-secondary-container/60">
                    Items
                  </p>
                  <div className="space-y-1.5">
                    {selectedBill.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-on-surface">{item.productName}</p>
                          <p className="text-[10px] text-on-secondary-container/60">
                            {item.quantity} × ₹{item.price.toFixed(0)}
                          </p>
                        </div>
                        <span className="shrink-0 font-bold tabular-nums text-on-surface">
                          ₹{item.total.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totals */}
                <div className="mx-4 mb-4 space-y-1 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3 text-sm">
                  <div className="flex justify-between text-on-secondary-container">
                    <span>Subtotal</span>
                    <span className="tabular-nums">₹{selectedBill.totalAmount.toFixed(2)}</span>
                  </div>
                  {selectedBill.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount</span>
                      <span className="tabular-nums">-₹{selectedBill.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {selectedBill.taxAmount > 0 && (
                    <div className="flex justify-between text-on-secondary-container">
                      <span>Tax</span>
                      <span className="tabular-nums">+₹{selectedBill.taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-outline-variant/20 pt-1.5 font-bold text-on-surface">
                    <span>Total</span>
                    <span className="text-primary tabular-nums">₹{selectedBill.finalAmount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Refund reason if refunded */}
                {selectedBill.status === "refunded" && selectedBill.refundReason && (
                  <div className="mx-4 mb-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-800">
                    <strong>Refund reason:</strong> {selectedBill.refundReason}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mx-4 mb-4 flex gap-2">
                  <button
                    onClick={() => handleReprint(selectedBill)}
                    disabled={reprinting}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {reprinting ? "sync" : "print"}
                    </span>
                    {reprinting ? "Printing…" : "Reprint"}
                  </button>

                  {selectedBill.status !== "refunded" && (
                    <button
                      onClick={() => handleRefund(selectedBill)}
                      disabled={refunding}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-red-200 py-3 text-sm font-bold text-red-700 transition active:scale-[0.98] disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                        {refunding ? "sync" : "undo"}
                      </span>
                      {refunding ? "Processing…" : "Refund"}
                    </button>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
