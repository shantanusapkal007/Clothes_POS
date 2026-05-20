"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { useStoreName } from "../lib/store-settings";

const NAV_ITEMS = [
  { name: "Sales", href: "/", icon: "payments" },
  { name: "Reports", href: "/reports", icon: "analytics" },
  { name: "Khata", href: "/khata", icon: "account_balance_wallet" },
  { name: "Inventory", href: "/inventory", icon: "inventory_2" },
  { name: "Expenses", href: "/expenses", icon: "receipt_long" },
  { name: "Settings", href: "/settings", icon: "settings" },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const storeName = useStoreName();
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  /* Restore collapsed state from localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      const isCollapsed = saved === "true";
      setCollapsed(isCollapsed);
      document.documentElement.style.setProperty(
        "--sidebar-w",
        isCollapsed ? "64px" : "220px"
      );
    } catch {
      /* localStorage not available (SSR guard) */
    }
  }, []);

  /* Sync CSS variable and localStorage whenever collapsed changes */
  useEffect(() => {
    try {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
    } catch { /* ignore */ }
    document.documentElement.style.setProperty(
      "--sidebar-w",
      collapsed ? "64px" : "220px"
    );
  }, [collapsed]);

  /* Handle top-bar padding on body */
  useEffect(() => {
    if (pathname !== "/" && pathname !== "/login") {
      document.body.classList.add("has-top-bar");
    } else {
      document.body.classList.remove("has-top-bar");
    }
  }, [pathname]);

  if (pathname === "/login") return null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  };

  return (
    <>
      {/* ───────────────────────────────────────────
          DESKTOP: Collapsible Floating Glassmorphic Sidebar
      ─────────────────────────────────────────── */}
      <aside
        className={`fixed left-4 top-4 bottom-4 z-50 hidden flex-col rounded-2xl border border-slate-200/50 bg-white/75 backdrop-blur-xl shadow-[0_12px_40px_rgba(15,23,42,0.065)] transition-all duration-300 ease-in-out md:flex ${
          collapsed ? "w-20" : "w-[240px]"
        }`}
      >
        {/* Brand + Toggle */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-slate-200/40 ${
            collapsed ? "justify-center px-0" : "justify-between px-5"
          }`}
        >
          {!collapsed && (
            <span className="truncate bg-gradient-to-r from-primary to-violet-600 bg-clip-text font-headline text-lg font-extrabold tracking-wide text-transparent">
              {storeName || "Friends POS"}
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/50 text-slate-500 transition-all hover:bg-slate-100 hover:text-primary active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {collapsed ? "menu" : "menu_open"}
            </span>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href as any}
                title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold tracking-wide transition-all duration-200 ${
                  collapsed ? "justify-center" : ""
                } ${
                  isActive
                    ? "bg-gradient-to-r from-primary to-violet-600 text-white shadow-[0_8px_20px_rgba(99,102,241,0.22)] scale-[1.02] border-r-4 border-violet-400"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-primary hover:translate-x-1"
                }`}
              >
                <span
                  className={`material-symbols-outlined shrink-0 transition-colors ${
                    isActive ? "text-white" : "text-slate-400"
                  }`}
                  style={{ fontSize: 22 }}
                >
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer: Sign Out */}
        <div className="shrink-0 border-t border-slate-200/40 p-3">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            title={collapsed ? "Sign out" : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 active:scale-95 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <span
              className="material-symbols-outlined shrink-0 text-slate-400"
              style={{ fontSize: 22 }}
            >
              logout
            </span>
            {!collapsed && (
              <span className="truncate">
                {signingOut ? "Signing out…" : "Sign out"}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ───────────────────────────────────────────
          MOBILE: Fixed Top Bar
      ─────────────────────────────────────────── */}
      {pathname !== "/" && (
        <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-slate-200/40 bg-white/80 px-4 backdrop-blur-md md:hidden"
          style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}
        >
          <span className="truncate bg-gradient-to-r from-primary to-violet-600 bg-clip-text font-headline text-base font-extrabold tracking-wide text-transparent">
            {storeName || "Friends POS"}
          </span>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100/50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-rose-600 active:opacity-70 disabled:opacity-50 touch-action-manipulation"
          >
            <span className="material-symbols-outlined text-lg sm:text-xl" style={{ fontSize: 20 }}>
              logout
            </span>
          </button>
        </header>
      )}

      {/* ───────────────────────────────────────────
          MOBILE: Bottom Tab Bar (Glassmorphic)
      ─────────────────────────────────────────── */}
      <nav
        className="bottom-tab-bar fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-slate-200/40 bg-white/80 backdrop-blur-lg md:hidden"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -4px 30px rgba(15,23,42,0.03)"
        }}
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href as any}
              className={`bottom-tab flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-all duration-200 ${
                isActive ? "text-primary scale-105" : "text-slate-500 hover:text-primary"
              }`}
            >
              <span className={`material-symbols-outlined text-lg sm:text-xl ${isActive ? "text-primary" : "text-slate-400"}`}>{item.icon}</span>
              <span className="text-[10px] sm:text-[11px]">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
