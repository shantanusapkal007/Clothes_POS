"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  DEFAULT_BILL_LAYOUT,
  DEFAULT_PRINTER_CONFIG,
  buildReceiptText,
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  disconnectSerialPrinter,
  getAvailableBluetoothPrinters,
  getAvailableSerialPrinters,
  getAvailableUsbPrinters,
  getBillLayoutConfig,
  getPrinterConfig,
  isBluetoothAvailable,
  isIosBrowser,
  isRawBtAvailable,
  isSerialAvailable,
  isShareAvailable,
  isUsbAvailable,
  normalizeBillLayoutConfig,
  openBrowserPrintWindow,
  requestBluetoothPrinter,
  requestSerialPrinter,
  requestUsbPrinter,
  saveBillLayoutConfig,
  savePrinterConfig,
  sendPrintData,
  shareReceiptText,
  type BillLayoutConfig,
  type PrinterConfig
} from "../lib/printer";
import { notifyStoreSettingsUpdated } from "../lib/store-settings";
import { BluetoothDeviceSelector } from "./BluetoothDeviceSelector";

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
  const [availableUsbPrinters, setAvailableUsbPrinters] = useState<PrinterConfig[]>([]);
  const [availableSerialPrinters, setAvailableSerialPrinters] = useState<PrinterConfig[]>([]);
  const [availableBluetoothPrinters, setAvailableBluetoothPrinters] = useState<PrinterConfig[]>([]);
  const [testPrintPending, setTestPrintPending] = useState(false);
  const [usbAvailable, setUsbAvailable] = useState(false);
  const [serialAvailable, setSerialAvailable] = useState(false);
  const [btAvailable, setBtAvailable] = useState(false);
  const [rawbtAvailable, setRawbtAvailable] = useState(false);
  const [iosBrowser, setIosBrowser] = useState(false);
  const [shareAvailable, setShareAvailable] = useState(false);
  const [btConnecting, setBtConnecting] = useState(false);
  const [serialConnecting, setSerialConnecting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showBluetoothSelector, setShowBluetoothSelector] = useState(false);

  useEffect(() => {
    const storedPrinter = getPrinterConfig();
    const storedLayout = getBillLayoutConfig();

    setPrinterConfig(storedPrinter);
    setBillLayout(storedLayout);
    setUsbAvailable(isUsbAvailable());
    setSerialAvailable(isSerialAvailable());
    setBtAvailable(isBluetoothAvailable());
    setIosBrowser(isIosBrowser());
    setRawbtAvailable(isRawBtAvailable());
    setShareAvailable(isShareAvailable());
    void loadAvailablePrinters();
  }, []);

  const showMessage = (text: string, type: "success" | "error" | "info" = "info") => {
    setMessage(text);
    setMessageType(type);
    window.setTimeout(() => setMessage(null), 4000);
  };

  const loadAvailablePrinters = async () => {
    try {
      const [usbPrinters, serialPrinters, bluetoothPrinters] = await Promise.all([
        getAvailableUsbPrinters(),
        getAvailableSerialPrinters(),
        getAvailableBluetoothPrinters()
      ]);
      setAvailableUsbPrinters(usbPrinters);
      setAvailableSerialPrinters(serialPrinters);
      setAvailableBluetoothPrinters(bluetoothPrinters);
    } catch {
      /* ignore */
    }
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

  const handleRequestUsbPrinter = async () => {
    if (!usbAvailable) {
      showMessage("USB printing requires Chrome/Edge over HTTPS.", "error");
      return;
    }
    try {
      const printer = await requestUsbPrinter();
      if (!printer) {
        showMessage("No USB printer selected", "error");
        return;
      }
      updatePrinter({ ...printer, width: billLayout.paperWidth });
      await loadAvailablePrinters();
      showMessage("USB printer connected", "success");
    } catch {
      showMessage("Failed to connect USB printer", "error");
    }
  };

  const handleRequestSerialPrinter = async () => {
    if (!serialAvailable) {
      showMessage("Serial requires desktop Chrome/Edge over HTTPS.", "error");
      return;
    }
    setSerialConnecting(true);
    try {
      const printer = await requestSerialPrinter(printerConfig.serialBaudRate ?? 9600);
      if (!printer) {
        showMessage("No serial printer selected", "error");
        return;
      }
      updatePrinter({ ...printer, width: billLayout.paperWidth });
      await loadAvailablePrinters();
      showMessage("Serial printer connected", "success");
    } catch {
      showMessage("Failed to connect serial printer", "error");
    } finally {
      setSerialConnecting(false);
    }
  };

  const handleRequestBluetoothPrinter = async () => {
    setBtConnecting(true);
    try {
      const printer = await requestBluetoothPrinter();
      if (!printer) {
        showMessage("No Bluetooth printer selected", "error");
        return;
      }
      const characteristic = await connectBluetoothPrinter(printer);
      updatePrinter({
        ...printer,
        width: billLayout.paperWidth,
        connected: Boolean(characteristic ?? printer.connected)
      });
      showMessage(characteristic ? "Bluetooth printer connected" : "Bluetooth paired", characteristic ? "success" : "info");
    } catch {
      showMessage("Failed to connect Bluetooth printer", "error");
    } finally {
      setBtConnecting(false);
    }
  };

  const handleBluetoothDeviceSelected = (device: PrinterConfig) => {
    updatePrinter({
      ...device,
      width: billLayout.paperWidth,
      connected: device.connected
    });
    setShowBluetoothSelector(false);
    showMessage(
      device.connected
        ? `${device.name} connected`
        : `${device.name} saved. Use AirPrint if direct Bluetooth is unavailable.`,
      device.connected ? "success" : "info"
    );
  };

  const handleDisconnectSerial = async () => {
    try { await disconnectSerialPrinter(); } finally {
      updatePrinter({ ...DEFAULT_PRINTER_CONFIG, width: printerConfig.width });
      showMessage("Serial printer disconnected", "info");
    }
  };

  const handleDisconnectBluetooth = () => {
    disconnectBluetoothPrinter();
    updatePrinter({ ...DEFAULT_PRINTER_CONFIG, width: printerConfig.width });
    showMessage("Bluetooth disconnected", "info");
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

  const handleTestPrint = async () => {
    try {
      setTestPrintPending(true);
      const content = buildReceiptText(
        {
          items: [
            { productName: "Sample Cotton Shirt", quantity: 1, price: 599, total: 599, discountPercent: 0, taxPercent: 0 },
            { productName: "Promo Jeans", quantity: 2, price: 999, total: 1798.2, discountPercent: 10, taxPercent: 0 }
          ],
          totalAmount: 2597, discountAmount: 199.8, taxAmount: 0, finalAmount: 2397.2,
          paymentMethod: "cash", createdAt: new Date().toISOString()
        },
        "TEST-01", billLayout, "cash"
      );

      const printed = await sendPrintData(content, printerConfig, billLayout);
      if (printed) {
        showMessage(`Test sent via ${printerConfig.connectionType.toUpperCase()}`, "success");
      } else {
        const opened = openBrowserPrintWindow(content, billLayout);
        showMessage(
          opened
            ? iosBrowser ? "AirPrint dialog opened" : "Browser print preview opened"
            : "Print failed — check connection",
          opened ? "info" : "error"
        );
      }
    } catch (error) {
      showMessage(`Test print failed: ${String(error)}`, "error");
    } finally {
      setTestPrintPending(false);
    }
  };

  const handleShareTest = async () => {
    const content = buildReceiptText(
      {
        items: [
          { productName: "Sample Cotton Shirt", quantity: 1, price: 599, total: 599, discountPercent: 0, taxPercent: 0 }
        ],
        totalAmount: 599, discountAmount: 0, taxAmount: 0, finalAmount: 599,
        paymentMethod: "cash", createdAt: new Date().toISOString()
      },
      "TEST-01", billLayout, "cash"
    );
    const shared = await shareReceiptText(content, "TEST-01");
    showMessage(shared ? "Receipt shared" : "Share cancelled", shared ? "success" : "info");
  };

  const liveReceiptPreview = useMemo(
    () =>
      buildReceiptText(
        {
          items: [
            { productName: "Armani Overshirt", quantity: 1, price: 500, total: 450, discountPercent: 10, manualDiscountAmount: 0, taxPercent: 0 },
            { productName: "Classic Denim", quantity: 2, price: 999, total: 1898, discountPercent: 0, manualDiscountAmount: 100, taxPercent: 0 }
          ],
          totalAmount: 2498, discountAmount: 150, taxAmount: 0, finalAmount: 2348,
          paymentMethod: "cash", createdAt: new Date().toISOString()
        },
        "PREVIEW-01", billLayout, "cash"
      ),
    [billLayout]
  );

  const receiptFontSize = billLayout.fontSize === "small" ? "10px" : billLayout.fontSize === "large" ? "13px" : "11px";

  const statusTone =
    messageType === "error"
      ? "bg-red-100 text-red-800 border-red-200"
      : messageType === "success"
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : "bg-blue-50 text-blue-800 border-blue-200";

  // Connection type cards data
  const connectionCards = [
    {
      key: "usb",
      icon: "usb",
      label: "USB",
      sublabel: "Wired",
      available: usbAvailable,
      active: printerConfig.connectionType === "usb" && printerConfig.connected,
      activeColor: "border-emerald-500 bg-emerald-50",
      onClick: handleRequestUsbPrinter,
      loading: false
    },
    {
      key: "bluetooth",
      icon: printerConfig.connectionType === "bluetooth" && printerConfig.connected ? "bluetooth_connected" : "bluetooth",
      label: printerConfig.connectionType === "bluetooth" && printerConfig.connected ? "Disconnect" : btConnecting ? "Scanning…" : "Bluetooth",
      sublabel: "BLE",
      available: btAvailable || iosBrowser,
      active: printerConfig.connectionType === "bluetooth" && printerConfig.connected,
      activeColor: "border-blue-500 bg-blue-50",
      onClick: printerConfig.connectionType === "bluetooth" && printerConfig.connected 
        ? handleDisconnectBluetooth 
        : iosBrowser
          ? () => setShowBluetoothSelector(true)
          : handleRequestBluetoothPrinter,
      loading: btConnecting
    },
    {
      key: "serial",
      icon: "cable",
      label: printerConfig.connectionType === "serial" && printerConfig.connected ? "Disconnect" : serialConnecting ? "Scanning…" : "Serial",
      sublabel: "COM Port",
      available: serialAvailable,
      active: printerConfig.connectionType === "serial" && printerConfig.connected,
      activeColor: "border-secondary bg-secondary-container",
      onClick: printerConfig.connectionType === "serial" && printerConfig.connected ? handleDisconnectSerial : handleRequestSerialPrinter,
      loading: serialConnecting
    },
    {
      key: "rawbt",
      icon: "print_connect",
      label: printerConfig.connectionType === "rawbt" && printerConfig.connected ? "RawBT ✓" : "RawBT",
      sublabel: "Android",
      available: rawbtAvailable,
      active: printerConfig.connectionType === "rawbt" && printerConfig.connected,
      activeColor: "border-tertiary bg-tertiary-fixed",
      onClick: () => {
        updatePrinter({
          ...DEFAULT_PRINTER_CONFIG,
          name: "RawBT Bluetooth Printer",
          connectionType: "rawbt",
          width: billLayout.paperWidth,
          connected: true
        });
        showMessage("RawBT enabled — pair your printer in the RawBT app", "success");
      },
      loading: false
    }
  ];

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
            <form onSubmit={handleSavePrinterConfig} className="space-y-4 md:space-y-6">
              {/* iOS Info Card */}
              {iosBrowser ? (
                <section className="rounded-lg border border-blue-200 bg-blue-50 p-3 md:p-4">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-blue-600 text-xl shrink-0">phone_iphone</span>
                    <div>
                      <p className="text-sm font-bold text-blue-900">iPhone / iPad</p>
                      <p className="mt-1 text-xs leading-relaxed text-blue-800/80">
                        iOS Safari uses <strong>AirPrint</strong> — tap &quot;Test Print&quot; to open the print sheet.
                        {shareAvailable ? " You can also share the receipt text to any app." : ""}
                      </p>
                    </div>
                  </div>
                  {shareAvailable && (
                    <button
                      type="button"
                      onClick={handleShareTest}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white py-2.5 text-xs font-bold text-blue-700 transition active:scale-95"
                    >
                      <span className="material-symbols-outlined text-[18px]">share</span>
                      Share Test Receipt
                    </button>
                  )}
                </section>
              ) : null}

              {/* Connection Cards */}
              <section>
                <span className="mb-3 block text-[9px] font-bold uppercase tracking-[0.2em] text-primary md:text-[10px]">
                  Connection
                </span>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  {connectionCards.map((card) => (
                    <button
                      key={card.key}
                      onClick={card.onClick}
                      type="button"
                      disabled={!card.available || card.loading}
                      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 bg-surface-container-highest p-3 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 md:gap-2 md:p-4 ${
                        card.active ? card.activeColor : "border-transparent"
                      }`}
                    >
                      <span className="material-symbols-outlined text-2xl text-on-surface-variant md:text-3xl">{card.icon}</span>
                      <span className="text-xs font-bold md:text-sm">{card.label}</span>
                      <span className="text-[9px] font-medium uppercase tracking-wider text-on-secondary-container md:text-[10px]">
                        {card.sublabel}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Printer Name & Paper Width */}
              <section className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant md:text-xs">
                    Printer Name
                  </span>
                  <input
                    className="field-input"
                    type="text"
                    value={printerConfig.name}
                    onChange={(event) => updatePrinter({ ...printerConfig, name: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant md:text-xs">
                    Paper Width
                  </span>
                  <select
                    className="field-input"
                    value={printerConfig.width}
                    onChange={(event) => {
                      const width = Number(event.target.value);
                      updatePrinter({ ...printerConfig, width });
                      updateLayout({ paperWidth: width });
                    }}
                  >
                    <option value={58}>58mm</option>
                    <option value={80}>80mm</option>
                    <option value={110}>110mm</option>
                  </select>
                </label>
              </section>

              {/* Status & Test */}
              <section className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/25 bg-white p-3 md:p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-primary">
                    {printerConfig.connected ? "Printer Ready" : "Not Connected"}
                  </p>
                  <p className="text-[10px] text-on-secondary-container md:text-xs">
                    {printerConfig.connectionType !== "none"
                      ? `${printerConfig.connectionType.toUpperCase()} — ${printerConfig.name}`
                      : iosBrowser ? "AirPrint / Safari print" : "Browser fallback"}
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low px-3 py-2.5 text-xs font-bold text-on-secondary-container transition active:scale-95 disabled:opacity-50 md:px-4 md:py-3 md:text-sm"
                  disabled={testPrintPending}
                  onClick={handleTestPrint}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {testPrintPending ? "sync" : "print"}
                  </span>
                  {testPrintPending ? "Sending…" : "Test"}
                </button>
              </section>

              {/* Detected Devices (collapsed by default on mobile) */}
              {(availableUsbPrinters.length > 0 || availableSerialPrinters.length > 0 || availableBluetoothPrinters.length > 0) && (
                <section className="rounded-lg border border-outline-variant/30 bg-white p-3 md:p-4">
                  <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-on-secondary-container">
                    Detected Devices
                  </span>
                  <div className="space-y-1.5 text-xs">
                    {availableUsbPrinters.map((p) => (
                      <div key={`usb-${p.vendorId}-${p.productId}`} className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-emerald-800">
                        USB: {p.name}
                      </div>
                    ))}
                    {availableSerialPrinters.map((p, i) => (
                      <div key={`serial-${i}`} className="rounded-md bg-surface-container-high px-2.5 py-1.5">
                        Serial: {p.name}
                      </div>
                    ))}
                    {availableBluetoothPrinters.map((p) => (
                      <div key={`bt-${p.bluetoothDeviceId}`} className="rounded-md bg-blue-50 px-2.5 py-1.5 text-blue-800">
                        BT: {p.name}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-on-primary shadow-md transition active:scale-[0.98] md:py-3.5"
                type="submit"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Printer Config
              </button>
            </form>
          ) : (
            /* ─── Bill Layout Tab ─── */
            <form onSubmit={handleSaveBillLayout} className="space-y-4 md:space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant md:text-xs">
                    Store Name
                  </span>
                  <input
                    className="field-input"
                    type="text"
                    value={billLayout.companyName}
                    onChange={(event) => updateLayout({ companyName: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant md:text-xs">
                    Phone
                  </span>
                  <input
                    className="field-input"
                    type="text"
                    value={billLayout.companyPhone || ""}
                    onChange={(event) => updateLayout({ companyPhone: event.target.value })}
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant md:text-xs">
                  WhatsApp Sender
                </span>
                <input
                  className="field-input"
                  type="tel"
                  value={billLayout.whatsappSenderPhone || ""}
                  onChange={(event) => updateLayout({ whatsappSenderPhone: event.target.value })}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant md:text-xs">
                  Address
                </span>
                <textarea
                  className="field-input resize-none"
                  rows={2}
                  value={billLayout.companyAddress || ""}
                  onChange={(event) => updateLayout({ companyAddress: event.target.value })}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant md:text-xs">
                  Footer Message
                </span>
                <input
                  className="field-input italic"
                  type="text"
                  value={billLayout.footerText || ""}
                  onChange={(event) => updateLayout({ footerText: event.target.value })}
                />
              </label>

              {/* Receipt settings grid */}
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-outline-variant/30 bg-white p-3 sm:grid-cols-4 md:p-4">
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Width</span>
                  <select
                    className="field-input"
                    value={billLayout.paperWidth}
                    onChange={(event) => {
                      const paperWidth = Number(event.target.value);
                      updateLayout({ paperWidth });
                      updatePrinter({ ...printerConfig, width: paperWidth });
                    }}
                  >
                    <option value={58}>58mm</option>
                    <option value={80}>80mm</option>
                    <option value={110}>110mm</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Font</span>
                  <select
                    className="field-input"
                    value={billLayout.fontSize}
                    onChange={(event) => updateLayout({ fontSize: event.target.value as BillLayoutConfig["fontSize"] })}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Chars/Line</span>
                  <input
                    className="field-input"
                    type="number"
                    min={20}
                    max={80}
                    value={billLayout.itemsPerLine}
                    onChange={(event) => updateLayout({ itemsPerLine: Number(event.target.value) })}
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">L</span>
                    <input
                      className="field-input"
                      type="number"
                      min={0}
                      max={20}
                      value={billLayout.marginLeft}
                      onChange={(event) => updateLayout({ marginLeft: Number(event.target.value) })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">R</span>
                    <input
                      className="field-input"
                      type="number"
                      min={0}
                      max={20}
                      value={billLayout.marginRight}
                      onChange={(event) => updateLayout({ marginRight: Number(event.target.value) })}
                    />
                  </label>
                </div>
              </div>

              {/* Display flags */}
              <div className="flex flex-wrap gap-4 rounded-lg border border-outline-variant/30 bg-white p-3 md:p-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={billLayout.showItemDetails} onChange={(event) => updateLayout({ showItemDetails: event.target.checked })} />
                  <span className="text-xs font-medium text-on-surface">Details</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={billLayout.showTaxBreakdown} onChange={(event) => updateLayout({ showTaxBreakdown: event.target.checked })} />
                  <span className="text-xs font-medium text-on-surface">Tax</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={billLayout.showDiscountBreakdown} onChange={(event) => updateLayout({ showDiscountBreakdown: event.target.checked })} />
                  <span className="text-xs font-medium text-on-surface">Discount</span>
                </label>
              </div>

              {/* Receipt Preview Toggle */}
              <div className="rounded-lg border border-outline-variant/30 bg-white">
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="flex w-full items-center justify-between p-3 text-xs font-bold uppercase tracking-widest text-on-secondary-container md:p-4 md:text-sm"
                >
                  <span>Receipt Preview</span>
                  <span className="material-symbols-outlined text-[18px] transition-transform duration-200"
                    style={{ transform: showPreview ? "rotate(180deg)" : "rotate(0deg)" }}
                  >
                    expand_more
                  </span>
                </button>
                {showPreview && (
                  <div className="border-t border-outline-variant/20 p-3 md:p-4">
                    <div className="hide-scrollbar overflow-x-auto rounded-lg border border-outline-variant/20 bg-[#f8fcfb] p-2">
                      <div
                        className="mx-auto rounded-lg border border-outline-variant/20 bg-white p-3 shadow-sm"
                        style={{ width: `${billLayout.paperWidth}mm`, maxWidth: "100%" }}
                      >
                        <pre
                          className="m-0 whitespace-pre text-black"
                          style={{
                            fontSize: receiptFontSize,
                            lineHeight: 1.2,
                            letterSpacing: 0,
                            fontVariantNumeric: "tabular-nums",
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                          }}
                        >
                          {liveReceiptPreview}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-bold text-on-primary shadow-md transition active:scale-[0.98] md:py-3.5"
                type="submit"
              >
                <span className="material-symbols-outlined text-[18px]">save</span>
                Save Store Settings
              </button>
            </form>
          )}
        </div>

      {/* Bluetooth Device Selector Modal */}
      {showBluetoothSelector && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mobile-drawer-backdrop"
            onClick={() => setShowBluetoothSelector(false)}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="mobile-drawer"
          >
            <div className="mobile-drawer__handle" />
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 px-4 pb-3 pt-1 md:px-8 md:pb-5 md:pt-4">
              <div>
                <h2 className="font-serif text-xl font-bold tracking-tight text-primary md:text-2xl">
                  Select Printer
                </h2>
              </div>
              <button
                className="material-symbols-outlined cursor-pointer rounded-lg p-2 text-secondary transition-colors hover:bg-error-container/50 hover:text-error"
                onClick={() => setShowBluetoothSelector(false)}
                title="Close"
                type="button"
              >
                close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6">
              <BluetoothDeviceSelector
                onSelectDevice={handleBluetoothDeviceSelected}
                onClose={() => setShowBluetoothSelector(false)}
                currentDeviceId={printerConfig.bluetoothDeviceId}
              />
            </div>
          </motion.div>
        </>
      )}
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
