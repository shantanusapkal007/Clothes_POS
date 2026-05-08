"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
import { useStoreName } from "../lib/store-settings";

const NAV_ITEMS = [
  { name: "Sales", href: "/" as const, icon: "payments" },
  { name: "Bills", href: "/bills" as const, icon: "receipt_long" },
  { name: "Khata", href: "/khata" as const, icon: "account_balance_wallet" },
  { name: "Stock", href: "/inventory" as const, icon: "inventory_2" },
  { name: "Settings", href: "/settings" as const, icon: "settings" },
] as const;

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
          DESKTOP: Collapsible Dark Sidebar
      ─────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 z-50 hidden h-screen flex-col bg-slate-900 transition-all duration-300 ease-in-out md:flex ${
          collapsed ? "w-16" : "w-[220px]"
        }`}
        style={{ boxShadow: "4px 0 24px rgba(0,0,0,0.25)" }}
      >
        {/* Brand + Toggle */}
        <div
          className={`flex h-14 shrink-0 items-center border-b border-white/10 ${
            collapsed ? "justify-center px-0" : "justify-between px-4"
          }`}
        >
          {!collapsed && (
            <span className="truncate text-sm font-bold tracking-wide text-white">
              {storeName || "Clothing POS"}
            </span>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/10 hover:text-white active:scale-95"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              {collapsed ? "menu" : "menu_open"}
            </span>
          </button>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2 pt-3">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                title={collapsed ? item.name : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                  collapsed ? "justify-center" : ""
                } ${
                  isActive
                    ? "bg-rose-700 text-white shadow-[0_4px_16px_rgba(190,18,60,0.45)]"
                    : "text-slate-400 hover:bg-white/8 hover:text-white"
                }`}
              >
                <span
                  className="material-symbols-outlined shrink-0"
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
        <div className="shrink-0 border-t border-white/10 p-2">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            title={collapsed ? "Sign out" : undefined}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-white/8 hover:text-white disabled:opacity-50 active:scale-95 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <span
              className="material-symbols-outlined shrink-0"
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
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-outline-variant/40 bg-white/95 px-4 backdrop-blur-xl md:hidden"
        style={{ boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}
      >
        <span className="truncate text-base font-bold text-primary">
          {storeName || "Clothing POS"}
        </span>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-on-secondary-container transition-colors hover:bg-surface-container-high active:opacity-70 disabled:opacity-50"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            logout
          </span>
        </button>
      </header>

      {/* ───────────────────────────────────────────
          MOBILE: Bottom Tab Bar
      ─────────────────────────────────────────── */}
      <nav
        className="bottom-tab-bar md:hidden"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`bottom-tab ${
                isActive ? "bottom-tab--active" : "bottom-tab--inactive"
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
