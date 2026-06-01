"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useStoreName } from "../lib/store-settings";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase/client";

const NAV_ITEMS = [
  { name: "Sales", href: "/", icon: "payments" },
  { name: "Reports", href: "/reports", icon: "analytics" },
  { name: "Khata", href: "/khata", icon: "account_balance_wallet" },
  { name: "Inventory", href: "/inventory", icon: "inventory_2" },
  { name: "Barcodes", href: "/barcodes", icon: "barcode_scanner" },
  { name: "Expenses", href: "/expenses", icon: "receipt_long" },
  { name: "Settings", href: "/settings", icon: "settings" },
];

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const storeName = useStoreName();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  /* Restore collapsed state from localStorage */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar-collapsed");
      const isCollapsed = saved === "true";
      setCollapsed(isCollapsed);
      document.documentElement.style.setProperty(
        "--sidebar-w",
        isCollapsed ? "96px" : "256px"
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
      collapsed ? "96px" : "256px"
    );
  }, [collapsed]);

  /* Close mobile sidebar on page navigation */
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (pathname === "/login") return null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut(auth);
      await fetch("/api/auth/logout", { method: "POST" });
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
          MOBILE: Fixed Top Bar (Always Present)
      ─────────────────────────────────────────── */}
      <header
        className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-slate-200/40 bg-white/80 px-4 backdrop-blur-md md:hidden"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.02)" }}
      >
        {/* Hamburger Toggle */}
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100/50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary active:scale-95 touch-action-manipulation"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
            menu
          </span>
        </button>

        {/* Brand/Store Name */}
        <span className="truncate bg-gradient-to-r from-primary to-violet-600 bg-clip-text font-headline text-base font-extrabold tracking-wide text-transparent">
          {storeName || "Friends POS"}
        </span>

        {/* Quick Sign Out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100/50 text-slate-500 transition-colors hover:bg-slate-100 hover:text-rose-600 active:opacity-70 disabled:opacity-50 touch-action-manipulation"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            logout
          </span>
        </button>
      </header>

      {/* ───────────────────────────────────────────
          MOBILE: Collapsible Left Sidebar (Drawer)
      ─────────────────────────────────────────── */}
      {/* Backdrop Overlay */}
      <div
        onClick={() => setMobileOpen(false)}
        className={`fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-all duration-300 md:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Left Sidebar Drawer Container */}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[280px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200/40 px-5 bg-slate-50/50">
          <span className="truncate bg-gradient-to-r from-primary to-violet-600 bg-clip-text font-headline text-base font-extrabold tracking-wide text-transparent">
            {storeName || "Friends POS"}
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-primary active:scale-95 touch-action-manipulation"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>

        {/* Drawer Nav Links */}
        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href as any}
                className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold tracking-wide transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-primary to-violet-600 text-white shadow-[0_8px_20px_rgba(99,102,241,0.22)] border-r-4 border-violet-400"
                    : "text-slate-600 hover:bg-slate-100/70 hover:text-primary"
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
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Drawer Footer: Sign Out */}
        <div className="shrink-0 border-t border-slate-200/40 p-4 bg-slate-50/50">
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-bold text-slate-600 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 active:scale-95 touch-action-manipulation"
          >
            <span
              className="material-symbols-outlined shrink-0 text-slate-400"
              style={{ fontSize: 22 }}
            >
              logout
            </span>
            <span className="truncate">
              {signingOut ? "Signing out…" : "Sign out"}
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}
