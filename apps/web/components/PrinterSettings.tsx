"use client";

import { motion } from "framer-motion";
import { useEffect, useState, type FormEvent } from "react";
import {
  DEFAULT_BILL_LAYOUT,
  DEFAULT_PRINTER_CONFIG,
  getBillLayoutConfig,
  getPrinterConfig,
  normalizeBillLayoutConfig,
  saveBillLayoutConfig,
  savePrinterConfig,
  type BillLayoutConfig,
  type PrinterConfig
} from "../lib/printer";
import { notifyStoreSettingsUpdated } from "../lib/store-settings";
import { PrinterTab } from "./PrinterTab";
import { StoreLayoutTab } from "./StoreLayoutTab";

interface PrinterSettingsProps {
  onClose?: () => void;
}

function sameValue<T>(left: T, right: T) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function PrinterSettings({ onClose }: PrinterSettingsProps) {
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig>(DEFAULT_PRINTER_CONFIG);
  const [billLayout, setBillLayout] = useState<BillLayoutConfig>(DEFAULT_BILL_LAYOUT);
  const [activeTab, setActiveTab] = useState<"printer" | "layout">("printer");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");

  useEffect(() => {
    const storedPrinter = getPrinterConfig();
    const storedLayout = getBillLayoutConfig();

    setPrinterConfig(storedPrinter);
    setBillLayout(storedLayout);
  }, []);

  const showMessage = (text: string, type: "success" | "error" | "info" = "info") => {
    setMessage(text);
    setMessageType(type);
    window.setTimeout(() => setMessage(null), 4000);
  };

  const persistPrinterConfig = (nextConfig: PrinterConfig) => {
    const normalized = { ...DEFAULT_PRINTER_CONFIG, ...nextConfig };
    setPrinterConfig(normalized);
    savePrinterConfig(normalized);
    return sameValue(getPrinterConfig(), normalized);
  };

  const persistBillLayout = (nextLayout: BillLayoutConfig) => {
    setBillLayout(nextLayout);
    saveBillLayoutConfig(nextLayout);
    notifyStoreSettingsUpdated();
    return sameValue(getBillLayoutConfig(), nextLayout);
  };

  const updatePrinter = (nextConfig: PrinterConfig) => {
    persistPrinterConfig(nextConfig);
  };

  const updateLayout = (partial: Partial<BillLayoutConfig>) => {
    const nextLayout = normalizeBillLayoutConfig({ ...billLayout, ...partial });
    persistBillLayout(nextLayout);
  };

  const handleSavePrinterConfig = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const persisted = persistPrinterConfig(printerConfig);
    showMessage(persisted ? "Printer config saved" : "Save failed", persisted ? "success" : "error");
  };

  const handleSaveBillLayout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const persisted = persistBillLayout(billLayout);
    showMessage(persisted ? "Bill layout saved" : "Save failed", persisted ? "success" : "error");
  };

  const statusTone =
    messageType === "error"
      ? "bg-red-100 text-red-800 border-red-200"
      : messageType === "success"
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : "bg-blue-50 text-blue-800 border-blue-200";

  const settingsContent = (
    <>
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-4 pb-3 pt-3 md:px-8 md:pb-5 md:pt-4">
          <div className="min-w-0">
            <h1 className="font-serif text-xl font-bold tracking-tight text-primary md:text-3xl">
              Settings
            </h1>
            <p className="mt-0.5 hidden text-xs text-on-secondary-container md:block md:text-sm">
              Configure store details, billing, and printers.
            </p>
          </div>
          {onClose && (
            <button
              className="material-symbols-outlined cursor-pointer rounded-lg p-2 text-secondary transition-colors hover:bg-error-container/50 hover:text-error"
              onClick={onClose}
              title="Close"
              type="button"
            >
              close
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="px-4 pt-3 md:px-8 md:pt-4">
          <div className="mobile-tab-bar">
            <button
              className={`mobile-tab ${activeTab === "printer" ? "mobile-tab--active" : "mobile-tab--inactive"}`}
              onClick={() => setActiveTab("printer")}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Printer
            </button>
            <button
              className={`mobile-tab ${activeTab === "layout" ? "mobile-tab--active" : "mobile-tab--inactive"}`}
              onClick={() => setActiveTab("layout")}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              Store
            </button>
          </div>
        </div>

        {/* Toast Message */}
        {message ? (
          <div className={`mx-4 mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium md:mx-8 md:text-sm ${statusTone}`}>
            <span className="material-symbols-outlined text-[16px]">
              {messageType === "error" ? "error" : messageType === "success" ? "check_circle" : "info"}
            </span>
            {message}
          </div>
        ) : null}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
          {activeTab === "printer" ? (
            <PrinterTab
              printerConfig={printerConfig}
              updatePrinter={updatePrinter}
              billLayout={billLayout}
              updateLayout={updateLayout}
              showMessage={showMessage}
              handleSavePrinterConfig={handleSavePrinterConfig}
            />
          ) : (
            <StoreLayoutTab
              billLayout={billLayout}
              updateLayout={updateLayout}
              printerConfig={printerConfig}
              updatePrinter={updatePrinter}
              handleSaveBillLayout={handleSaveBillLayout}
            />
          )}
        </div>
    </>
  );

  // ── Modal mode (opened from POS workspace) ──
  if (onClose) {
    return (
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="mobile-drawer-backdrop"
          onClick={onClose}
        />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="mobile-drawer"
        >
          <div className="mobile-drawer__handle" />
          {settingsContent}
        </motion.div>
      </>
    );
  }

  // ── Standalone mode (settings page) ──
  return (
    <div className="flex flex-col h-full">
      {settingsContent}
    </div>
  );
}