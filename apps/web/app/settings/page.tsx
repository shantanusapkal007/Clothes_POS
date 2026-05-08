"use client";

import { PrinterSettings } from "../../components/PrinterSettings";

export default function SettingsPage() {
  return (
    <div className="main-content">
      <div className="mx-auto max-w-4xl px-3 py-4 pb-24 md:px-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-on-surface md:text-2xl">Settings</h1>
          <p className="mt-0.5 text-xs text-on-secondary-container">
            Manage your store details, bill layout, and printer connections
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-outline-variant/30 bg-white shadow-sm">
          {/* We render PrinterSettings directly here. 
              Since PrinterSettings was designed as a modal/sheet, 
              rendering it inline will work as a settings dashboard. */}
          <PrinterSettings />
        </div>
      </div>
    </div>
  );
}
