"use client";

import { PrinterSettings } from "../../components/PrinterSettings";

export default function SettingsPage() {
  return (
    <div className="main-content">
      <div className="mx-auto max-w-4xl px-3 py-4 pb-24 md:px-6 md:py-8">
        <PrinterSettings />
      </div>
    </div>
  );
}
