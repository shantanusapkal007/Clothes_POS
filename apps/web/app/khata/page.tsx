"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  getCustomers,
  createCustomer,
  deleteCustomer,
  recordPayment,
  addCredit,
  type CustomerResponse,
} from "../../lib/api";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function KhataPage() {
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  /* ── Add customer form ── */
  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addBalance, setAddBalance] = useState("");
  const [addPending, setAddPending] = useState(false);

  /* ── Selected customer detail ── */
  const [selected, setSelected] = useState<CustomerResponse | null>(null);

  /* ── Payment form ── */
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [payPending, setPayPending] = useState(false);

  /* ── Credit form ── */
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [creditPending, setCreditPending] = useState(false);

  const [activeTab, setActiveTab] = useState<"pay" | "credit">("pay");

  const showMsg = useCallback((text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCustomers(search.trim() || undefined);
      setCustomers(data);
    } catch {
      showMsg("Failed to load customers", "error");
    } finally {
      setLoading(false);
    }
  }, [search, showMsg]);

  useEffect(() => { void load(); }, [load]);

  const totalPending = useMemo(() => customers.reduce((s, c) => s + c.balance, 0), [customers]);

  /* ── Add customer ── */
  const handleAdd = async () => {
    if (!addName.trim() || !addPhone.trim()) {
      showMsg("Name and phone required", "error");
      return;
    }
    try {
      setAddPending(true);
      const c = await createCustomer({
        name: addName.trim(),
        phone: addPhone.trim(),
        balance: parseFloat(addBalance) || 0,
      });
      setCustomers((prev) => [c, ...prev]);
      setAddName(""); setAddPhone(""); setAddBalance("");
      setShowAdd(false);
      showMsg(`${c.name} added`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Failed to add", "error");
    } finally {
      setAddPending(false);
    }
  };

  /* ── Delete ── */
  const handleDelete = async (c: CustomerResponse) => {
    if (!confirm(`Delete ${c.name}? All payment history will be lost.`)) return;
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      if (selected?.id === c.id) setSelected(null);
      showMsg("Customer deleted");
    } catch {
      showMsg("Failed to delete", "error");
    }
  };

  /* ── Record Payment ── */
  const handlePay = async () => {
    if (!selected) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) { showMsg("Enter valid amount", "error"); return; }
    try {
      setPayPending(true);
      const updated = await recordPayment(selected.id, {
        amount: amt,
        method: payMethod,
        note: payNote.trim() || undefined,
      });
      setSelected(updated);
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setPayAmount(""); setPayNote("");
      showMsg(`₹${amt} payment recorded`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Payment failed", "error");
    } finally {
      setPayPending(false);
    }
  };

  /* ── Add Credit ── */
  const handleCredit = async () => {
    if (!selected) return;
    const amt = parseFloat(creditAmount);
    if (!amt || amt <= 0) { showMsg("Enter valid amount", "error"); return; }
    try {
      setCreditPending(true);
      const updated = await addCredit(selected.id, {
        amount: amt,
        note: creditNote.trim() || undefined,
      });
      setSelected(updated);
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setCreditAmount(""); setCreditNote("");
      showMsg(`₹${amt} credit added`);
    } catch (e) {
      showMsg(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setCreditPending(false);
    }
  };

  /* ── WhatsApp reminder ── */
  const sendReminder = (c: CustomerResponse) => {
    const msg = encodeURIComponent(
      `Hi ${c.name}, this is a reminder about your pending balance of ₹${c.balance.toFixed(2)}. Please visit the store to settle. Thank you!`
    );
    const phone = c.phone.replace(/[^0-9]/g, "");
    const url = phone.length >= 10
      ? `https://wa.me/91${phone.slice(-10)}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
  };

  return (
    <div className="main-content">
      <div className="mx-auto max-w-3xl px-3 py-4 pb-24 md:px-6 md:py-8">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-on-surface md:text-2xl">Khata Book</h1>
            <p className="mt-0.5 text-xs text-on-secondary-container">
              Customer udhar &amp; payment tracking
            </p>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white shadow-sm transition active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {showAdd ? "close" : "person_add"}
            </span>
            {showAdd ? "Cancel" : "Add"}
          </button>
        </div>

        {/* Stats */}
        <div className="mb-4 flex gap-2">
          <div className="flex-1 rounded-xl border border-outline-variant/30 bg-white p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-on-secondary-container">Customers</p>
            <p className="text-lg font-bold tabular-nums text-on-surface">{customers.length}</p>
          </div>
          <div className={`flex-1 rounded-xl border p-3 ${totalPending > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${totalPending > 0 ? "text-red-700" : "text-emerald-700"}`}>
              Total Pending
            </p>
            <p className={`text-lg font-bold tabular-nums ${totalPending > 0 ? "text-red-800" : "text-emerald-800"}`}>
              ₹{totalPending.toFixed(0)}
            </p>
          </div>
        </div>

        {/* Toast */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`mb-3 rounded-lg border px-3 py-2 text-xs font-medium ${
                message.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {message.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Customer Form */}
        <AnimatePresence>
          {showAdd && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-xl border border-outline-variant/30 bg-white p-4 space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-on-secondary-container">New Customer</p>
                <input
                  className="field-input"
                  placeholder="Customer Name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  style={{ fontSize: 16 }}
                />
                <input
                  className="field-input"
                  placeholder="Mobile Number"
                  type="tel"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  style={{ fontSize: 16 }}
                />
                <input
                  className="field-input"
                  placeholder="Opening Balance (₹) — optional"
                  type="number"
                  value={addBalance}
                  onChange={(e) => setAddBalance(e.target.value)}
                  style={{ fontSize: 16 }}
                />
                <button
                  onClick={handleAdd}
                  disabled={addPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                >
                  {addPending ? "Adding…" : "Add Customer"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-white px-3 py-2.5">
          <span className="material-symbols-outlined text-on-secondary-container/50" style={{ fontSize: 18 }}>search</span>
          <input
            className="flex-1 border-none bg-transparent text-sm text-on-surface placeholder:text-on-secondary-container/50 focus:outline-none focus:ring-0"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ fontSize: 16 }}
          />
        </div>

        {/* Customer List */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container-high/50" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="material-symbols-outlined mb-2 text-4xl text-on-surface-variant/30">person_off</span>
            <p className="text-sm font-medium text-on-surface">No customers yet</p>
            <p className="mt-0.5 text-xs text-on-secondary-container">
              Add customers to track their pending payments
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map((c) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-outline-variant/30 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setSelected(selected?.id === c.id ? null : c)}
                  className="flex w-full items-center gap-3 p-3 text-left transition active:bg-surface-container-low"
                >
                  {/* Avatar */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-sm font-bold text-primary">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-on-surface">{c.name}</p>
                    <p className="text-[11px] text-on-secondary-container">{c.phone}</p>
                  </div>

                  {/* Balance */}
                  <div className="shrink-0 text-right">
                    <p className={`text-base font-bold tabular-nums ${c.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      ₹{c.balance.toFixed(0)}
                    </p>
                    <p className="text-[9px] font-bold uppercase text-on-secondary-container/50">
                      {c.balance > 0 ? "pending" : "clear"}
                    </p>
                  </div>

                  <span className="material-symbols-outlined text-on-secondary-container/30" style={{ fontSize: 18 }}>
                    {selected?.id === c.id ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {/* Quick actions row (always visible) */}
                <div className="flex border-t border-outline-variant/20 divide-x divide-outline-variant/20">
                  {c.balance > 0 && (
                    <button
                      onClick={() => sendReminder(c)}
                      className="flex flex-1 items-center justify-center gap-1 py-2 text-[11px] font-bold text-emerald-700 transition active:bg-emerald-50"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>send</span>
                      WhatsApp
                    </button>
                  )}
                  <button
                    onClick={() => { setSelected(c); setActiveTab("pay"); }}
                    className="flex flex-1 items-center justify-center gap-1 py-2 text-[11px] font-bold text-primary transition active:bg-primary/5"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>payments</span>
                    Pay
                  </button>
                  <button
                    onClick={() => { setSelected(c); setActiveTab("credit"); }}
                    className="flex flex-1 items-center justify-center gap-1 py-2 text-[11px] font-bold text-amber-700 transition active:bg-amber-50"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add_card</span>
                    Udhar
                  </button>
                  <button
                    onClick={() => handleDelete(c)}
                    className="flex items-center justify-center px-3 py-2 text-[11px] font-bold text-red-500 transition active:bg-red-50"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── Customer Detail Bottom Sheet ─── */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
                onClick={() => setSelected(null)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-[101] max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.15)]"
                style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
              >
                <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-outline-variant/30" />

                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-2 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-lg font-bold text-primary">
                        {selected.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-on-surface">{selected.name}</h2>
                      <p className="text-xs text-on-secondary-container">{selected.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold tabular-nums ${selected.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>
                      ₹{selected.balance.toFixed(2)}
                    </p>
                    <p className="text-[9px] font-bold uppercase text-on-secondary-container/50">
                      {selected.balance > 0 ? "pending" : "all clear"}
                    </p>
                  </div>
                </div>

                {/* Tab: Pay / Add Credit */}
                <div className="mx-4 mt-2 mb-3 flex rounded-lg bg-surface-container-high/50 p-0.5">
                  <button
                    onClick={() => setActiveTab("pay")}
                    className={`flex-1 rounded-md py-2 text-xs font-bold transition ${
                      activeTab === "pay" ? "bg-white text-primary shadow-sm" : "text-on-secondary-container"
                    }`}
                  >
                    Record Payment
                  </button>
                  <button
                    onClick={() => setActiveTab("credit")}
                    className={`flex-1 rounded-md py-2 text-xs font-bold transition ${
                      activeTab === "credit" ? "bg-white text-amber-700 shadow-sm" : "text-on-secondary-container"
                    }`}
                  >
                    Add Udhar
                  </button>
                </div>

                {/* Pay form */}
                {activeTab === "pay" && (
                  <div className="mx-4 mb-3 space-y-2 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-3">
                    <div className="flex gap-2">
                      <input
                        className="field-input flex-1"
                        placeholder="Amount (₹)"
                        type="number"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        style={{ fontSize: 16 }}
                      />
                      <select
                        className="field-input w-24"
                        value={payMethod}
                        onChange={(e) => setPayMethod(e.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="upi">UPI</option>
                        <option value="card">Card</option>
                      </select>
                    </div>
                    <input
                      className="field-input"
                      placeholder="Note (optional)"
                      value={payNote}
                      onChange={(e) => setPayNote(e.target.value)}
                      style={{ fontSize: 16 }}
                    />
                    {selected.balance > 0 && (
                      <button
                        onClick={() => setPayAmount(String(selected.balance))}
                        className="text-[11px] font-bold text-primary"
                      >
                        Full payment: ₹{selected.balance.toFixed(2)}
                      </button>
                    )}
                    <button
                      onClick={handlePay}
                      disabled={payPending}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>payments</span>
                      {payPending ? "Processing…" : "Record Payment"}
                    </button>
                  </div>
                )}

                {/* Credit form */}
                {activeTab === "credit" && (
                  <div className="mx-4 mb-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                    <input
                      className="field-input"
                      placeholder="Udhar Amount (₹)"
                      type="number"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      style={{ fontSize: 16 }}
                    />
                    <input
                      className="field-input"
                      placeholder="Note (e.g. bill ref, item name)"
                      value={creditNote}
                      onChange={(e) => setCreditNote(e.target.value)}
                      style={{ fontSize: 16 }}
                    />
                    <button
                      onClick={handleCredit}
                      disabled={creditPending}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-600 py-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_card</span>
                      {creditPending ? "Adding…" : "Add Credit"}
                    </button>
                  </div>
                )}

                {/* Payment History */}
                <div className="mx-4 mb-4">
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-on-secondary-container/60">
                    Payment History
                  </p>
                  {selected.payments.length === 0 ? (
                    <p className="rounded-lg bg-surface-container-lowest p-3 text-center text-xs text-on-secondary-container/50">
                      No payments yet
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {selected.payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface-container-lowest p-2.5">
                          <div>
                            <p className="text-xs font-medium text-on-surface">
                              ₹{p.amount.toFixed(2)}
                              <span className="ml-1.5 rounded-md bg-surface-container-high px-1.5 py-0.5 text-[9px] font-bold uppercase text-on-secondary-container">
                                {p.method}
                              </span>
                            </p>
                            {p.note && (
                              <p className="mt-0.5 text-[10px] text-on-secondary-container/60">{p.note}</p>
                            )}
                          </div>
                          <p className="text-[10px] text-on-secondary-container/50 tabular-nums">
                            {formatDate(p.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* WhatsApp Reminder */}
                {selected.balance > 0 && (
                  <div className="mx-4 mb-4">
                    <button
                      onClick={() => sendReminder(selected)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-200 py-3 text-sm font-bold text-emerald-700 transition active:scale-[0.98]"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                      Send WhatsApp Reminder
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
