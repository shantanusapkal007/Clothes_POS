"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { getSuppliers, createSupplier, deleteSupplier, recordPurchase } from "../lib/api";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  balance: number;
  purchases: any[];
};

export function SupplierManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  /* Form states */
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [balance, setBalance] = useState("");
  const [pending, setPending] = useState(false);

  /* Purchase Form */
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");

  const showMsg = useCallback((text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSuppliers(search || undefined);
      setSuppliers(data);
    } catch {
      showMsg("Failed to load suppliers", "error");
    } finally {
      setLoading(false);
    }
  }, [search, showMsg]);

  useEffect(() => { void load(); }, [load]);

  const handleAdd = async () => {
    if (!name.trim()) { showMsg("Name is required", "error"); return; }
    try {
      setPending(true);
      const s = await createSupplier({ name, phone, email, balance: parseFloat(balance) || 0 });
      setSuppliers([s, ...suppliers]);
      setName(""); setPhone(""); setEmail(""); setBalance("");
      setShowAdd(false);
      showMsg("Supplier added");
    } catch {
      showMsg("Failed to add", "error");
    } finally {
      setPending(false);
    }
  };

  const handleDelete = async (id: string, sname: string) => {
    if (!confirm(`Delete ${sname}?`)) return;
    try {
      await deleteSupplier(id);
      setSuppliers(suppliers.filter(s => s.id !== id));
      if (selected?.id === id) setSelected(null);
      showMsg("Supplier removed");
    } catch {
      showMsg("Failed to delete", "error");
    }
  };

  const handlePurchase = async () => {
    if (!selected) return;
    const amt = parseFloat(purchaseAmount);
    if (!amt || amt <= 0) { showMsg("Enter valid amount", "error"); return; }
    try {
      setPending(true);
      await recordPurchase(selected.id, { amount: amt, note: purchaseNote });
      const updatedS = { ...selected, balance: Number(selected.balance) + amt };
      setSuppliers(suppliers.map(s => s.id === selected.id ? updatedS : s));
      setSelected(updatedS);
      setPurchaseAmount(""); setPurchaseNote("");
      showMsg("Purchase recorded");
    } catch {
      showMsg("Failed to record", "error");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Suppliers & Vendors</h2>
          <p className="text-sm text-slate-500">Track purchase history and vendor payments (Purchase Khata).</p>
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition active:scale-95"
        >
          <span className="material-symbols-outlined">{showAdd ? "close" : "person_add"}</span>
          {showAdd ? "Cancel" : "Add Supplier"}
        </button>
      </div>

      {/* Message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-sm ${
              message.type === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input className="field-input" placeholder="Supplier Name" value={name} onChange={e => setName(e.target.value)} />
                <input className="field-input" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} />
                <input className="field-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <input className="field-input" placeholder="Opening Balance (₹)" type="number" value={balance} onChange={e => setBalance(e.target.value)} />
              </div>
              <button
                onClick={handleAdd}
                disabled={pending}
                className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-100 transition active:scale-[0.98] disabled:opacity-50"
              >
                {pending ? "Adding..." : "Add Supplier"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <span className="material-symbols-outlined text-slate-400">search</span>
        <input
          className="flex-1 border-none bg-transparent text-sm font-bold text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-0"
          placeholder="Search suppliers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : suppliers.length === 0 ? (
        <div className="py-12 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl mb-2">person_off</span>
          <p className="text-sm font-bold">No suppliers found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {suppliers.map(s => (
            <div key={s.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm transition hover:shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center">
                <button
                  onClick={() => setSelected(s)}
                  className="flex flex-1 items-center gap-4 p-4 text-left"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
                    <span className="text-lg font-black">{s.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-bold text-slate-900">{s.name}</h3>
                    <p className="text-xs font-medium text-slate-400">{s.phone || "No phone"}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-black tabular-nums ${s.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                      ₹{Number(s.balance).toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] font-black uppercase text-slate-300">
                      {s.balance > 0 ? "You Owe" : "Clear"}
                    </p>
                  </div>
                </button>
                <div className="flex border-t border-slate-50 sm:border-l sm:border-t-0">
                  <button
                    onClick={() => setSelected(s)}
                    className="flex flex-1 items-center justify-center gap-2 px-6 py-4 text-xs font-black text-slate-900 transition hover:bg-slate-50 sm:flex-none"
                  >
                    <span className="material-symbols-outlined text-lg">history</span>
                    LEDGER
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.name)}
                    className="flex items-center justify-center px-4 py-4 text-rose-300 transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    <span className="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail View */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-md" onClick={() => setSelected(null)} />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              className="fixed inset-x-0 bottom-0 z-[101] flex max-h-[90vh] flex-col rounded-t-[32px] bg-white shadow-2xl"
              style={{ paddingBottom: "env(safe-area-inset-bottom, 24px)" }}
            >
              <div className="mx-auto mt-4 mb-2 h-1.5 w-12 rounded-full bg-slate-100" />
              <div className="flex items-center justify-between border-b border-slate-50 px-8 py-6">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selected.name}</h2>
                  <p className="text-sm font-bold text-slate-400">{selected.phone}</p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black ${selected.balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>₹{Number(selected.balance).toLocaleString("en-IN")}</p>
                  <p className="text-xs font-black text-slate-300 uppercase">Vendor Udhar</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="mb-8 rounded-3xl border-2 border-slate-50 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xs font-black uppercase text-slate-400 tracking-widest">Record New Purchase</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input className="field-input" placeholder="Bill Amount (₹)" type="number" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} />
                    <input className="field-input" placeholder="Note (e.g. Bill #123)" value={purchaseNote} onChange={e => setPurchaseNote(e.target.value)} />
                  </div>
                  <button
                    onClick={handlePurchase}
                    disabled={pending}
                    className="mt-4 w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white shadow-xl transition active:scale-[0.98] disabled:opacity-50"
                  >
                    {pending ? "RECORDING..." : "ADD PURCHASE TO KHATA"}
                  </button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Recent Purchases</h3>
                  <div className="space-y-2">
                    {selected.purchases?.length === 0 ? (
                      <p className="py-8 text-center text-sm font-bold text-slate-300">No purchase history yet.</p>
                    ) : (
                      selected.purchases?.map((p: any) => (
                        <div key={p.id} className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                          <div>
                            <p className="text-sm font-black text-slate-900">₹{Number(p.amount).toLocaleString("en-IN")}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">{p.note || "Inventory Stock"}</p>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(p.createdAt).toLocaleDateString()}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
