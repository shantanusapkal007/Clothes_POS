"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import useSWR from "swr";

type Expense = {
  id: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  createdAt: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const d = await res.json();
    throw new Error(d.message || "Failed to load expenses");
  }
  return res.json();
};

export default function ExpensesPage() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Utilities");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);

  const EXPENSE_CATEGORIES = ["Utilities", "Supplies", "Rent", "Salary", "Maintenance", "Marketing", "Other"];

  const { data: expensesData, error: swrError, isLoading, mutate } = useSWR<Expense[]>(
    "/api/expenses",
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const expenses = expensesData || [];
  const loading = isLoading;

  useEffect(() => {
    if (swrError) {
      setError(swrError.message);
    }
  }, [swrError]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          category,
          description: description || null,
          date: date ? new Date(date).toISOString() : new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed to create expense");
      }

      const newExpense = await res.json();
      void mutate([newExpense, ...expenses], { revalidate: true });
      setAmount("");
      setDescription("");
      setMessage("Expense added successfully");
    } catch (err: any) {
      setError(err.message || "Failed to submit expense");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed to delete expense");
      }
      void mutate(expenses.filter(e => e.id !== id), { revalidate: true });
      setMessage("Expense deleted");
    } catch (err: any) {
      setError(err.message || "Failed to delete expense");
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="main-content">
      <div className="mx-auto max-w-4xl px-3 py-4 pb-24 md:px-6 md:py-8">
        <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-on-surface md:text-2xl">Expenses</h1>
            <p className="mt-0.5 text-xs text-on-secondary-container">
              Track your store expenses
            </p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 min-w-[200px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Total Recorded</p>
            <p className="text-xl font-bold text-rose-800 tabular-nums">₹{totalExpenses.toFixed(2)}</p>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4"
            >
              <div className="flex items-center gap-2 text-red-800">
                <span className="material-symbols-outlined">error</span>
                <p className="text-sm font-medium">{error}</p>
              </div>
            </motion.div>
          )}
          
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4"
            >
              <div className="flex items-center gap-2 text-emerald-800">
                <span className="material-symbols-outlined">check_circle</span>
                <p className="text-sm font-medium">{message}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-6 items-start">
          {/* Add Expense Form */}
          <div className="glass-panel p-4 rounded-xl">
            <h2 className="mb-4 text-lg font-bold text-on-surface">Add Expense</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-secondary-container">Amount (₹)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="field-input"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-secondary-container">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="field-input"
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-secondary-container">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  className="field-input"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-secondary-container">Description (Optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="field-input"
                  placeholder="What was this for?"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="button button-primary w-full"
              >
                {submitting ? "Adding..." : "Add Expense"}
              </button>
            </form>
          </div>

          {/* Expenses List */}
          <div className="glass-panel p-4 rounded-xl min-h-[400px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-on-surface">Recent Expenses</h2>
              <button onClick={() => mutate()} className="text-primary hover:bg-surface-container-high p-1 rounded-md transition-colors" title="Refresh">
                <span className="material-symbols-outlined">refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <span className="material-symbols-outlined animate-spin text-4xl text-on-surface-variant/30">refresh</span>
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-on-surface-variant/50">
                <span className="material-symbols-outlined text-4xl mb-2">receipt_long</span>
                <p>No expenses recorded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {expenses.map(exp => (
                  <motion.div
                    key={exp.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between rounded-lg border border-outline-variant/30 p-3 bg-surface-container-lowest"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-on-surface">{exp.category}</span>
                        <span className="text-[10px] text-on-secondary-container">{new Date(exp.date).toLocaleDateString()}</span>
                      </div>
                      {exp.description && (
                        <p className="text-xs text-on-secondary-container mt-0.5">{exp.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-rose-600">₹{exp.amount.toFixed(2)}</span>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="text-on-secondary-container/40 hover:text-red-500 transition-colors"
                        title="Delete expense"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
