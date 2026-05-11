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

  const handleDelete = async (c: CustomerResponse) => {
    if (!confirm(`Delete ${c.name}? All history will be lost.`)) return;
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      if (selected?.id === c.id) setSelected(null);
      showMsg("Customer deleted");
    } catch {
      showMsg("Failed to delete", "error");
    }
  };

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

  const sendReminder = (c: CustomerResponse) => {
    const msg = encodeURIComponent(
      `Hi ${c.name}, this is a reminder about your pending balance of ₹${c.balance.toFixed(2)} at Clothing POS. Please settle at your earliest convenience. Thank you!`
    );
    const phone = c.phone.replace(/[^0-9]/g, "");
    const url = phone.length >= 10
      ? `https://wa.me/91${phone.slice(-10)}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
  };

  return (
    <div className="main-content min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-4xl px-4 py-6 pb-32 md:py-10">
        
        {/* Header Section */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">Khata Book</h1>
            <p className="text-sm font-medium text-slate-500">Premium Ledger Management</p>
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-slate-200 transition hover:bg-slate-800 active:scale-95"
          >
            <span className="material-symbols-outlined">{showAdd ? "close" : "add"}</span>
            {showAdd ? "Close Form" : "Add New Customer"}
          </button>
        </div>

        {/* Dynamic Summary Cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="group relative overflow-hidden rounded-3xl border border-white bg-white/60 p-6 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Customers</p>
                <p className="mt-1 text-3xl font-black text-slate-900">{customers.length}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <span className="material-symbols-outlined text-3xl">groups</span>
              </div>
            </div>
          </div>
          <div className={`group relative overflow-hidden rounded-3xl border border-white p-6 shadow-sm backdrop-blur-xl transition ${totalPending > 0 ? "bg-rose-50/50" : "bg-emerald-50/50"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-widest ${totalPending > 0 ? "text-rose-400" : "text-emerald-400"}`}>You'll Get</p>
                <p className={`mt-1 text-3xl font-black ${totalPending > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                  ₹{totalPending.toLocaleString("en-IN")}
                </p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${totalPending > 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"}`}>
                <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <AnimatePresence>
          {message && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`mb-6 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-sm ${
                message.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              <span className="material-symbols-outlined">{message.type === "error" ? "error" : "check_circle"}</span>
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
              className="mb-8 overflow-hidden"
            >
              <div className="rounded-3xl border border-white bg-white/40 p-6 shadow-sm backdrop-blur-xl">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Name</label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 focus:border-slate-900 focus:ring-0"
                      placeholder="e.g. Rahul Sharma"
                      value={addName}
                      onChange={(e) => setAddName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Phone</label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 focus:border-slate-900 focus:ring-0"
                      placeholder="e.g. 9876543210"
                      value={addPhone}
                      onChange={(e) => setAddPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Initial Udhar</label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 focus:border-slate-900 focus:ring-0"
                      placeholder="₹0.00"
                      type="number"
                      value={addBalance}
                      onChange={(e) => setAddBalance(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  onClick={handleAdd}
                  disabled={addPending}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-sm font-black text-white shadow-lg shadow-indigo-100 transition hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-50"
                >
                  {addPending ? "SAVING..." : "CREATE CUSTOMER ACCOUNT"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Bar */}
        <div className="sticky top-20 z-40 mb-6 flex items-center gap-4 rounded-3xl border border-white bg-white/70 px-6 py-4 shadow-sm backdrop-blur-2xl transition-all duration-300 focus-within:bg-white focus-within:shadow-md">
          <span className="material-symbols-outlined text-slate-400">search</span>
          <input
            className="flex-1 border-none bg-transparent text-base font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Customer List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/50" />
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white/40 py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <span className="material-symbols-outlined text-4xl text-slate-300">person_off</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Customers Found</h3>
            <p className="text-sm text-slate-500">Try searching for something else or add a new customer.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {customers.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group relative overflow-hidden rounded-3xl border border-white bg-white/60 p-1 shadow-sm transition-all hover:bg-white hover:shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center">
                  {/* Basic Info */}
                  <button
                    onClick={() => setSelected(c)}
                    className="flex flex-1 items-center gap-4 p-5 text-left"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-200">
                      <span className="text-lg font-black">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-bold text-slate-900">{c.name}</h3>
                      <p className="text-xs font-medium text-slate-400">{c.phone}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-xl font-black tabular-nums ${c.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        ₹{c.balance.toLocaleString("en-IN")}
                      </p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                        {c.balance > 0 ? "Pending" : "Settled"}
                      </p>
                    </div>
                  </button>

                  {/* Actions Row */}
                  <div className="flex border-t border-slate-100 sm:border-l sm:border-t-0">
                    <button
                      onClick={() => sendReminder(c)}
                      className="flex flex-1 items-center justify-center gap-2 px-6 py-4 text-xs font-black text-emerald-600 transition hover:bg-emerald-50 active:bg-emerald-100 sm:flex-none"
                    >
                      <span className="material-symbols-outlined text-lg">send</span>
                      REMIND
                    </button>
                    <button
                      onClick={() => setSelected(c)}
                      className="flex flex-1 items-center justify-center gap-2 px-6 py-4 text-xs font-black text-slate-900 transition hover:bg-slate-50 active:bg-slate-100 sm:flex-none"
                    >
                      <span className="material-symbols-outlined text-lg">history</span>
                      LEDGER
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="flex items-center justify-center px-4 py-4 text-rose-300 transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ─── Premium Bottom Sheet (Detail View) ─── */}
        <AnimatePresence>
          {selected && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md"
                onClick={() => setSelected(null)}
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[92vh] flex-col rounded-t-[40px] bg-white shadow-2xl"
                style={{ paddingBottom: "env(safe-area-inset-bottom, 24px)" }}
              >
                <div className="mx-auto mt-4 mb-2 h-1.5 w-12 rounded-full bg-slate-100" />

                {/* Sticky Header inside Sheet */}
                <div className="flex items-center justify-between border-b border-slate-50 px-8 py-6">
                  <div className="flex items-center gap-5">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-slate-900 text-white shadow-xl shadow-slate-200">
                      <span className="text-2xl font-black">{selected.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">{selected.name}</h2>
                      <div className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-400">
                        <span className="material-symbols-outlined text-base">call</span>
                        {selected.phone}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-black tabular-nums ${selected.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      ₹{selected.balance.toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-300">Current Balance</p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6">
                  
                  {/* Action Tabs */}
                  <div className="mb-8 grid grid-cols-2 gap-3 rounded-3xl bg-slate-50 p-2">
                    <button
                      onClick={() => setActiveTab("pay")}
                      className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black transition ${
                        activeTab === "pay" ? "bg-white text-emerald-600 shadow-md" : "text-slate-400"
                      }`}
                    >
                      <span className="material-symbols-outlined">payments</span>
                      PAYMENT IN
                    </button>
                    <button
                      onClick={() => setActiveTab("credit")}
                      className={`flex items-center justify-center gap-2 rounded-2xl py-4 text-sm font-black transition ${
                        activeTab === "credit" ? "bg-white text-rose-600 shadow-md" : "text-slate-400"
                      }`}
                    >
                      <span className="material-symbols-outlined">add_card</span>
                      ADD UDHAR
                    </button>
                  </div>

                  {/* Form Section */}
                  <div className="mb-10 animate-in fade-in slide-in-from-bottom-4">
                    <div className="space-y-4 rounded-[32px] border-2 border-slate-50 bg-white p-6 shadow-sm">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                            {activeTab === "pay" ? "Amount Received" : "Udhar Amount"}
                          </label>
                          <input
                            className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-lg font-black text-slate-900 focus:border-slate-900 focus:bg-white focus:ring-0"
                            placeholder="₹0.00"
                            type="number"
                            value={activeTab === "pay" ? payAmount : creditAmount}
                            onChange={(e) => activeTab === "pay" ? setPayAmount(e.target.value) : setCreditAmount(e.target.value)}
                          />
                        </div>
                        {activeTab === "pay" && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Method</label>
                            <select
                              className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-lg font-black text-slate-900 focus:border-slate-900 focus:bg-white focus:ring-0"
                              value={payMethod}
                              onChange={(e) => setPayMethod(e.target.value)}
                            >
                              <option value="cash">Cash</option>
                              <option value="upi">UPI</option>
                              <option value="card">Card</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Notes</label>
                        <input
                          className="w-full rounded-2xl border border-slate-100 bg-slate-50 px-5 py-4 text-base font-bold text-slate-900 focus:border-slate-900 focus:bg-white focus:ring-0"
                          placeholder="What is this for?"
                          value={activeTab === "pay" ? payNote : creditNote}
                          onChange={(e) => activeTab === "pay" ? setPayNote(e.target.value) : setCreditNote(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={activeTab === "pay" ? handlePay : handleCredit}
                        disabled={payPending || creditPending}
                        className={`w-full rounded-2xl py-5 text-base font-black text-white shadow-xl transition active:scale-[0.98] disabled:opacity-50 ${
                          activeTab === "pay" ? "bg-emerald-600 shadow-emerald-100" : "bg-rose-600 shadow-rose-100"
                        }`}
                      >
                        {activeTab === "pay" 
                          ? (payPending ? "RECORDING..." : "CONFIRM PAYMENT IN")
                          : (creditPending ? "SAVING..." : "CONFIRM UDHAR ENTRY")
                        }
                      </button>
                    </div>
                  </div>

                  {/* Visual Ledger Timeline */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Transaction Ledger</h3>
                      <div className="h-px flex-1 mx-4 bg-slate-100" />
                    </div>
                    
                    {selected.payments.length === 0 ? (
                      <div className="py-10 text-center">
                        <p className="text-sm font-bold text-slate-300">No transactions recorded yet.</p>
                      </div>
                    ) : (
                      <div className="relative space-y-4">
                        {/* Timeline Line */}
                        <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-slate-100" />
                        
                        {selected.payments.map((p, idx) => (
                          <div key={p.id} className="relative flex items-start gap-4">
                            <div className={`z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-4 border-white shadow-sm ${
                              p.method === "credit" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                            }`}>
                              <span className="material-symbols-outlined text-lg">
                                {p.method === "credit" ? "remove_circle" : "add_circle"}
                              </span>
                            </div>
                            <div className="flex-1 rounded-3xl border border-slate-50 bg-slate-50/30 p-4">
                              <div className="flex items-center justify-between">
                                <p className={`text-base font-black tabular-nums ${p.method === "credit" ? "text-rose-600" : "text-emerald-600"}`}>
                                  {p.method === "credit" ? "-" : "+"} ₹{p.amount.toLocaleString("en-IN")}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{formatDate(p.createdAt)}</p>
                              </div>
                              <div className="mt-1 flex items-center justify-between">
                                <p className="text-xs font-bold text-slate-900">
                                  {p.note || (p.method === "credit" ? "Udhar Entry" : "Payment Received")}
                                </p>
                                <span className="text-[9px] font-black uppercase text-slate-300">{p.method}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Reminder */}
                {selected.balance > 0 && (
                  <div className="border-t border-slate-50 p-6">
                    <button
                      onClick={() => sendReminder(selected)}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-50 py-4 text-sm font-black text-emerald-600 transition hover:bg-emerald-100"
                    >
                      <span className="material-symbols-outlined">send</span>
                      SEND WHATSAPP SUMMARY
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
