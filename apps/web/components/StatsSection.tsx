"use client";

import React, { useEffect, useState, useMemo } from "react";
import { getStats } from "../lib/api";

// ── Types ────────────────────────────────────────────────────────────────────

type StatsItem = {
  productId: string;
  name: string;
  stock: number;
  minStock: number;
  totalSold: number;
  revenue: number;
  profit: number;
};

type StatsData = {
  items: StatsItem[];
  summary: { totalExpenses: number };
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-IN");
const inr = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const GLASS =
  "bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(31,38,135,0.07)] rounded-2xl";

const RANK_COLORS = [
  "from-amber-400 to-yellow-500",   // Gold
  "from-slate-300 to-slate-400",     // Silver
  "from-amber-600 to-amber-700",     // Bronze
];

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  subtitle?: string;
  accent: string;
}) {
  return (
    <div className={`${GLASS} p-5 flex flex-col gap-3 transition-transform hover:scale-[1.02] hover:shadow-lg`}>
      {/* Icon pill */}
      <div
        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shadow-md`}
      >
        <span className="material-symbols-outlined text-white text-[22px]">{icon}</span>
      </div>

      {/* Label */}
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>

      {/* Value */}
      <p className="text-2xl md:text-3xl font-extrabold text-slate-800 leading-none tracking-tight">
        {value}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-xs font-semibold text-slate-500">{subtitle}</p>
      )}
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="material-symbols-outlined text-lg text-slate-500">{icon}</span>
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">{title}</h3>
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-200/60" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-64 rounded-2xl bg-slate-200/60" />
        ))}
      </div>
      <div className="h-72 rounded-2xl bg-slate-200/60" />
    </div>
  );
}

// ── Error state ──────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
      <span className="material-symbols-outlined text-3xl text-rose-400 mb-2 block">error</span>
      <p className="text-rose-700 font-semibold">{message}</p>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function StatsSection() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const result = await getStats();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load stats");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────

  const totalRevenue = useMemo(
    () => data?.items.reduce((s, i) => s + i.revenue, 0) ?? 0,
    [data]
  );

  const totalProfit = useMemo(
    () => data?.items.reduce((s, i) => s + i.profit, 0) ?? 0,
    [data]
  );

  const profitMargin = useMemo(
    () => (totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0),
    [totalRevenue, totalProfit]
  );

  const totalExpenses = data?.summary.totalExpenses ?? 0;

  const lowStockItems = useMemo(
    () => data?.items.filter((i) => i.stock <= i.minStock) ?? [],
    [data]
  );

  const topSellers = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => b.totalSold - a.totalSold).slice(0, 5),
    [data]
  );

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorBanner message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* ───────── KPI Metrics Row ───────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon="payments"
          label="Total Revenue"
          value={inr(totalRevenue)}
          accent="from-emerald-400 to-green-600"
        />
        <KpiCard
          icon="trending_up"
          label="Gross Profit"
          value={inr(totalProfit)}
          subtitle={`${profitMargin.toFixed(1)}% margin`}
          accent="from-teal-400 to-emerald-600"
        />
        <KpiCard
          icon="receipt_long"
          label="Total Expenses"
          value={inr(totalExpenses)}
          accent="from-amber-400 to-orange-500"
        />
        <KpiCard
          icon="inventory_2"
          label="Low Stock Alerts"
          value={lowStockItems.length > 0 ? String(lowStockItems.length) : "0"}
          subtitle={lowStockItems.length === 0 ? "All Good! ✅" : `${lowStockItems.length} item${lowStockItems.length > 1 ? "s" : ""} need restock`}
          accent={lowStockItems.length > 0 ? "from-rose-400 to-red-600" : "from-emerald-400 to-green-600"}
        />
      </div>

      {/* ───────── Two-column panels ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Top Selling Products ── */}
        <div className={`${GLASS} p-5`}>
          <SectionHeader icon="emoji_events" title="Top Selling Products" />

          {topSellers.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">No sales data yet</p>
          ) : (
            <div className="space-y-2">
              {topSellers.map((item, idx) => (
                <div
                  key={item.productId}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    idx % 2 === 0 ? "bg-slate-50/60" : "bg-white/40"
                  }`}
                >
                  {/* Rank badge */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-extrabold shrink-0 ${
                      idx < 3
                        ? `bg-gradient-to-br ${RANK_COLORS[idx]} text-white shadow-sm`
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {idx + 1}
                  </div>

                  {/* Product name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-700 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{fmt(item.totalSold)} units sold</p>
                  </div>

                  {/* Revenue */}
                  <p className="text-sm font-bold text-slate-700 whitespace-nowrap">{inr(item.revenue)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Low Stock Items ── */}
        <div className={`${GLASS} p-5`}>
          <SectionHeader icon="warning" title="Low Stock Items" />

          {lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <span className="material-symbols-outlined text-5xl text-emerald-400">
                check_circle
              </span>
              <p className="text-emerald-600 font-semibold text-sm">All products are well-stocked!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item) => {
                const isZero = item.stock === 0;
                return (
                  <div
                    key={item.productId}
                    className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/60"
                  >
                    {/* Status icon */}
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isZero
                          ? "bg-gradient-to-br from-rose-400 to-red-600"
                          : "bg-gradient-to-br from-amber-400 to-orange-500"
                      }`}
                    >
                      <span className="material-symbols-outlined text-white text-[16px]">
                        {isZero ? "dangerous" : "report"}
                      </span>
                    </div>

                    {/* Product info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{item.name}</p>
                      <p className="text-xs text-slate-400">Min stock: {fmt(item.minStock)}</p>
                    </div>

                    {/* Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        isZero
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isZero ? "Out of stock" : `${fmt(item.stock)} left`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ───────── Revenue Breakdown Table ───────── */}
      <div className={`${GLASS} p-5 overflow-hidden`}>
        <SectionHeader icon="bar_chart" title="Revenue Breakdown" />

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/80">
                <th className="text-left py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Product
                </th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    Sold
                    <span className="material-symbols-outlined text-[14px]">unfold_more</span>
                  </span>
                </th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    Revenue
                    <span className="material-symbols-outlined text-[14px]">unfold_more</span>
                  </span>
                </th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    Profit
                    <span className="material-symbols-outlined text-[14px]">unfold_more</span>
                  </span>
                </th>
                <th className="text-right py-3 px-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Margin
                </th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, idx) => {
                const margin = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0;
                return (
                  <tr
                    key={item.productId}
                    className={`border-b border-slate-100/80 transition-colors hover:bg-slate-50/60 ${
                      idx % 2 === 0 ? "bg-transparent" : "bg-slate-50/30"
                    }`}
                  >
                    <td className="py-3 px-2 font-medium text-slate-700">{item.name}</td>
                    <td className="py-3 px-2 text-right text-slate-600 tabular-nums">{fmt(item.totalSold)}</td>
                    <td className="py-3 px-2 text-right font-semibold text-slate-700 tabular-nums">
                      {inr(item.revenue)}
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-semibold tabular-nums ${
                        item.profit >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {item.profit < 0 ? `-${inr(item.profit)}` : inr(item.profit)}
                    </td>
                    <td
                      className={`py-3 px-2 text-right font-semibold tabular-nums ${
                        margin >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Totals row */}
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td className="py-3 px-2 font-extrabold text-slate-800">Total</td>
                <td className="py-3 px-2 text-right font-extrabold text-slate-800 tabular-nums">
                  {fmt(data.items.reduce((s, i) => s + i.totalSold, 0))}
                </td>
                <td className="py-3 px-2 text-right font-extrabold text-slate-800 tabular-nums">
                  {inr(totalRevenue)}
                </td>
                <td
                  className={`py-3 px-2 text-right font-extrabold tabular-nums ${
                    totalProfit >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {totalProfit < 0 ? `-${inr(totalProfit)}` : inr(totalProfit)}
                </td>
                <td
                  className={`py-3 px-2 text-right font-extrabold tabular-nums ${
                    profitMargin >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {profitMargin.toFixed(1)}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
