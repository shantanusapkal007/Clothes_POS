/**
 * Thermal Printer Integration
 * Supports ESC/POS protocol for thermal printers via:
 * - WebUSB (direct USB printer)
 * - Web Bluetooth (BLE/GATT printers only)
 * - Web Serial (USB-serial adapters / Bluetooth SPP COM ports on desktop)
 */

export type ConnectionType = "usb" | "serial" | "bluetooth" | "rawbt" | "none";

export interface BluetoothDeviceInfo {
  id: string;
  name: string;
  address?: string;
  lastConnected?: number;
  savedManually?: boolean;
}

export interface PrinterConfig {
  name: string;
  connectionType: ConnectionType;
  deviceId?: string;
  vendorId?: string;
  productId?: string;
  bluetoothDeviceId?: string;
  serialBaudRate?: number;
  width: number;
  connected: boolean;
}

export interface BillLayoutConfig {
  companyName: string;
  companyPhone?: string;
  whatsappSenderPhone?: string;
  companyAddress?: string;
  showItemDetails: boolean;
  showTaxBreakdown: boolean;
  showDiscountBreakdown: boolean;
  printLogoUrl?: string;
  footerText?: string;
  itemsPerLine: number;
  fontSize: "small" | "medium" | "large";
  paperWidth: number;
  marginLeft: number;
  marginRight: number;
}

export interface PrintableBillItem {
  productName: string;
  quantity: number;
  price: number;
  total: number;
  discountPercent: number;
  manualDiscountAmount?: number;
  taxPercent: number;
}

export interface PrintableBillData {
  items: PrintableBillItem[];
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
  paymentMethod: string;
  createdAt?: string;
}

export type PrintTransportResult = "device" | "browser" | "failed";

const PRINTER_STORAGE_KEY = "printer-config";
const BILL_LAYOUT_STORAGE_KEY = "bill-layout-config";
const PAIRED_BT_DEVICES_STORAGE_KEY = "paired-bt-devices";

export const STORE_WHATSAPP_NUMBER = "+919552884468";

const USB_REQUEST_FILTERS = [
  { classCode: 0x07 },
  { vendorId: 0x0416 },
  { vendorId: 0x04b8 },
  { vendorId: 0x0483 },
  { vendorId: 0x0fe6 },
];

const BT_PRINTER_SERVICE_UUIDS = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Common ESC/POS printers
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2", // Generic serial
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // Microchip ISSC / many BT printers
  "0000ffe0-0000-1000-8000-00805f9b34fb", // BLE UART (FFE0)
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART Service (NUS)
  "0000fff0-0000-1000-8000-00805f9b34fb", // Common vendor UART
  "0000ff00-0000-1000-8000-00805f9b34fb", // Common vendor UART
];

const BT_PRINTER_CHAR_UUIDS = [
  "00002af1-0000-1000-8000-00805f9b34fb",
  "bef8d6c9-9c21-4c9e-b632-bd58c1009f9f",
  "49535343-8841-43f4-a8d4-ecbe34729bb3",
  "0000ffe1-0000-1000-8000-00805f9b34fb", // BLE UART (FFE1)
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e", // NUS write
  "0000fff1-0000-1000-8000-00805f9b34fb",
  "0000ff01-0000-1000-8000-00805f9b34fb",
];

let bluetoothDevice: any = null;
let bluetoothCharacteristic: any = null;
let serialPort: any = null;

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  name: "Thermal Printer",
  connectionType: "none",
  width: 80,
  connected: false,
};

export const DEFAULT_BILL_LAYOUT: BillLayoutConfig = {
  companyName: "Clothing Store",
  companyPhone: STORE_WHATSAPP_NUMBER,
  whatsappSenderPhone: STORE_WHATSAPP_NUMBER,
  showItemDetails: true,
  showTaxBreakdown: true,
  showDiscountBreakdown: true,
  footerText: "Thank you for shopping with us!",
  itemsPerLine: 42,
  fontSize: "medium",
  paperWidth: 80,
  marginLeft: 2,
  marginRight: 2,
};

export const ESC_POS = {
  INIT: "\x1b\x40",
  FONT_A: "\x1b\x4d\x00",
  FONT_B: "\x1b\x4d\x01",
  BOLD_ON: "\x1b\x45\x01",
  BOLD_OFF: "\x1b\x45\x00",
  ALIGN_LEFT: "\x1b\x61\x00",
  ALIGN_CENTER: "\x1b\x61\x01",
  ALIGN_RIGHT: "\x1b\x61\x02",
  SIZE_NORMAL: "\x1d\x21\x00",
  SIZE_DOUBLE: "\x1d\x21\x11",
  NEWLINE: "\x0a",
  CUT_PAPER: "\x1d\x56\x42\x00",
  FEED_LINES: (lines: number) => `\x1b\x64${String.fromCharCode(lines)}`,
};

function getDefaultItemsPerLine(
  paperWidth: number,
  fontSize: BillLayoutConfig["fontSize"],
): number {
  if (paperWidth <= 58) {
    return fontSize === "small" ? 42 : fontSize === "large" ? 24 : 32;
  }

  if (paperWidth >= 110) {
    return fontSize === "small" ? 80 : fontSize === "large" ? 42 : 64;
  }

  return fontSize === "small" ? 56 : fontSize === "large" ? 32 : 42;
}

export function normalizeBillLayoutConfig(
  config: Partial<BillLayoutConfig> = {},
): BillLayoutConfig {
  const fontSize = config.fontSize ?? DEFAULT_BILL_LAYOUT.fontSize;
  const paperWidth =
    Number(config.paperWidth ?? DEFAULT_BILL_LAYOUT.paperWidth) ||
    DEFAULT_BILL_LAYOUT.paperWidth;
  const computedItemsPerLine = getDefaultItemsPerLine(paperWidth, fontSize);

  return {
    ...DEFAULT_BILL_LAYOUT,
    ...config,
    fontSize,
    paperWidth,
    itemsPerLine:
      Number(config.itemsPerLine ?? computedItemsPerLine) ||
      computedItemsPerLine,
    marginLeft: Math.max(
      0,
      Number(config.marginLeft ?? DEFAULT_BILL_LAYOUT.marginLeft) || 0,
    ),
    marginRight: Math.max(
      0,
      Number(config.marginRight ?? DEFAULT_BILL_LAYOUT.marginRight) || 0,
    ),
  };
}

export function getPrinterConfig(): PrinterConfig {
  if (typeof window === "undefined") {
    return DEFAULT_PRINTER_CONFIG;
  }

  const stored = localStorage.getItem(PRINTER_STORAGE_KEY);
  if (!stored) {
    return DEFAULT_PRINTER_CONFIG;
  }

  try {
    return {
      ...DEFAULT_PRINTER_CONFIG,
      ...(JSON.parse(stored) as Partial<PrinterConfig>),
    };
  } catch {
    return DEFAULT_PRINTER_CONFIG;
  }
}

export function savePrinterConfig(config: PrinterConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  localStorage.setItem(
    PRINTER_STORAGE_KEY,
    JSON.stringify({
      ...DEFAULT_PRINTER_CONFIG,
      ...config,
    }),
  );
}

export function getBillLayoutConfig(): BillLayoutConfig {
  if (typeof window === "undefined") {
    return DEFAULT_BILL_LAYOUT;
  }

  const stored = localStorage.getItem(BILL_LAYOUT_STORAGE_KEY);
  if (!stored) {
    return DEFAULT_BILL_LAYOUT;
  }

  try {
    return normalizeBillLayoutConfig(
      JSON.parse(stored) as Partial<BillLayoutConfig>,
    );
  } catch {
    return DEFAULT_BILL_LAYOUT;
  }
}

export function saveBillLayoutConfig(config: Partial<BillLayoutConfig>): void {
  if (typeof window === "undefined") {
    return;
  }

  const current = getBillLayoutConfig();
  const updated = normalizeBillLayoutConfig({ ...current, ...config });
  localStorage.setItem(BILL_LAYOUT_STORAGE_KEY, JSON.stringify(updated));
}

/**
 * Get all paired Bluetooth devices from storage
 * Includes devices previously connected or manually added
 */
export function getPairedBluetoothDevices(): BluetoothDeviceInfo[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = localStorage.getItem(PAIRED_BT_DEVICES_STORAGE_KEY);
  if (!stored) {
    return [];
  }

  try {
    const devices = JSON.parse(stored) as BluetoothDeviceInfo[];
    return Array.isArray(devices) ? devices : [];
  } catch {
    return [];
  }
}

/**
 * Add or update a paired Bluetooth device in storage
 */
export function savePairedBluetoothDevice(device: BluetoothDeviceInfo): void {
  if (typeof window === "undefined") {
    return;
  }

  const devices = getPairedBluetoothDevices();
  const existing = devices.findIndex((d) => d.id === device.id);
  
  const updated: BluetoothDeviceInfo = {
    ...device,
    lastConnected: Date.now(),
  };

  if (existing >= 0) {
    devices[existing] = updated;
  } else {
    devices.push(updated);
  }

  localStorage.setItem(PAIRED_BT_DEVICES_STORAGE_KEY, JSON.stringify(devices));
}

/**
 * Remove a paired Bluetooth device from storage
 */
export function removePairedBluetoothDevice(deviceId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const devices = getPairedBluetoothDevices().filter((d) => d.id !== deviceId);
  localStorage.setItem(PAIRED_BT_DEVICES_STORAGE_KEY, JSON.stringify(devices));
}

function formatAmount(value: number): string {
  return `Rs ${value.toFixed(2)}`;
}

function wrapText(text: string, width: number): string[] {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return [""];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines.flatMap((line) => {
    if (line.length <= width) {
      return [line];
    }

    const chunks: string[] = [];
    for (let index = 0; index < line.length; index += width) {
      chunks.push(line.slice(index, index + width));
    }
    return chunks;
  });
}

function padLine(left: string, right: string, width: number): string {
  const safeLeft = left.trim();
  const safeRight = right.trim();
  const maxRightWidth = Math.max(0, width - 2);
  const clippedRight =
    safeRight.length > maxRightWidth
      ? safeRight.slice(safeRight.length - maxRightWidth)
      : safeRight;
  const remaining = width - safeLeft.length - clippedRight.length;

  if (remaining >= 1) {
    return `${safeLeft}${" ".repeat(remaining)}${clippedRight}`;
  }

  const leftSpace = Math.max(0, width - clippedRight.length - 1);
  const clippedLeft =
    safeLeft.length > leftSpace && leftSpace > 2
      ? `${safeLeft.slice(0, leftSpace - 2)}..`
      : safeLeft.slice(0, leftSpace);
  const padding = Math.max(1, width - clippedLeft.length - clippedRight.length);
  return `${clippedLeft}${" ".repeat(padding)}${clippedRight}`.slice(0, width);
}

function centerText(text: string, width: number): string {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length >= width) {
    return trimmed.slice(0, width);
  }

  const leftPadding = Math.floor((width - trimmed.length) / 2);
  return `${" ".repeat(leftPadding)}${trimmed}`;
}

function getMarginCharacters(layout: BillLayoutConfig) {
  return {
    left: Math.round(layout.marginLeft / 2),
    right: Math.round(layout.marginRight / 2),
  };
}

function buildItemAmountLine(item: PrintableBillItem, width: number): string {
  const amount = item.total.toFixed(2);

  if (width >= 40) {
    return padLine(
      `${item.quantity} x ${item.price.toFixed(2)}`,
      amount,
      width,
    );
  }

  return padLine(`${item.quantity}x${item.price.toFixed(2)}`, amount, width);
}

function buildReceiptLines(
  bill: PrintableBillData,
  billNumber: string,
  layout: BillLayoutConfig,
  paymentMethod: string,
): string[] {
  const { left, right } = getMarginCharacters(layout);
  const receiptWidth = Math.max(24, layout.itemsPerLine - left - right);
  const separator = "-".repeat(receiptWidth);
  const lines: string[] = [];
  const pushWrapped = (text: string, align: "left" | "center" = "left") => {
    for (const line of wrapText(text, receiptWidth)) {
      lines.push(align === "center" ? centerText(line, receiptWidth) : line);
    }
  };

  pushWrapped(layout.companyName, "center");

  if (layout.companyAddress) {
    pushWrapped(layout.companyAddress, "center");
  }

  if (layout.companyPhone) {
    pushWrapped(`Phone: ${layout.companyPhone}`, "center");
  }

  lines.push(separator);

  const receiptDate = bill.createdAt ? new Date(bill.createdAt) : new Date();

  lines.push(padLine("Bill", billNumber, receiptWidth));
  lines.push(
    padLine(
      "Date",
      receiptDate.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
      receiptWidth,
    ),
  );
  lines.push(separator);
  lines.push(padLine("Item / Qty x Rate", "Amount", receiptWidth));
  lines.push(separator);

  for (const item of bill.items) {
    for (const [index, line] of wrapText(
      item.productName,
      receiptWidth,
    ).entries()) {
      lines.push(index === 0 ? line : `  ${line}`.slice(0, receiptWidth));
    }

    lines.push(buildItemAmountLine(item, receiptWidth));

    if (
      layout.showItemDetails &&
      (item.discountPercent > 0 ||
        (item.manualDiscountAmount ?? 0) > 0 ||
        item.taxPercent > 0)
    ) {
      const detailParts = [
        item.discountPercent > 0 ? `Disc ${item.discountPercent}%` : "",
        (item.manualDiscountAmount ?? 0) > 0
          ? `Less ${formatAmount(item.manualDiscountAmount ?? 0)}`
          : "",
        item.taxPercent > 0 ? `Tax ${item.taxPercent}%` : "",
      ].filter(Boolean);
      lines.push(`  ${detailParts.join(" | ")}`.slice(0, receiptWidth));
    }
  }

  lines.push(separator);
  lines.push(padLine("Subtotal", formatAmount(bill.totalAmount), receiptWidth));

  if (layout.showDiscountBreakdown && bill.discountAmount > 0) {
    lines.push(
      padLine(
        "Discount",
        `-${formatAmount(bill.discountAmount)}`,
        receiptWidth,
      ),
    );
  }

  if (layout.showTaxBreakdown && bill.taxAmount > 0) {
    lines.push(padLine("Tax", formatAmount(bill.taxAmount), receiptWidth));
  }

  lines.push(separator);
  lines.push(padLine("TOTAL", formatAmount(bill.finalAmount), receiptWidth));
  lines.push(padLine("Payment", paymentMethod.toUpperCase(), receiptWidth));
  lines.push(separator);

  if (layout.footerText) {
    pushWrapped(layout.footerText, "center");
  }

  return lines.map(
    (line) =>
      `${" ".repeat(left)}${line.slice(0, receiptWidth)}${" ".repeat(right)}`,
  );
}

export function buildReceiptText(
  bill: PrintableBillData,
  billNumber: string,
  layout: BillLayoutConfig = getBillLayoutConfig(),
  paymentMethod = bill.paymentMethod,
): string {
  return buildReceiptLines(bill, billNumber, layout, paymentMethod).join("\n");
}

export function generateEscPos(
  lines: string[],
  billLayout: BillLayoutConfig,
): string {
  let commands = ESC_POS.INIT;
  commands += ESC_POS.ALIGN_LEFT;

  if (billLayout.fontSize === "small") {
    commands += ESC_POS.FONT_B;
    commands += ESC_POS.SIZE_NORMAL;
  } else if (billLayout.fontSize === "large") {
    commands += ESC_POS.FONT_A;
    commands += ESC_POS.SIZE_DOUBLE;
  } else {
    commands += ESC_POS.FONT_A;
    commands += ESC_POS.SIZE_NORMAL;
  }

  for (const line of lines) {
    commands += `${line}${ESC_POS.NEWLINE}`;
  }

  commands += ESC_POS.FEED_LINES(4);
  commands += ESC_POS.CUT_PAPER;
  return commands;
}

export function isUsbAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "usb" in navigator
  );
}

export function isSerialAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serial" in navigator
  );
}

export function isIosBrowser(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const platform = navigator.platform || "";

  return (
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export async function getAvailableUsbPrinters(): Promise<PrinterConfig[]> {
  if (!isUsbAvailable()) {
    return [];
  }

  try {
    const devices = await (navigator as any).usb.getDevices();
    return devices.map((device: any) => ({
      name: device.productName || `USB Printer ${device.productId}`,
      connectionType: "usb",
      deviceId: device.serialNumber,
      vendorId: String(device.vendorId),
      productId: String(device.productId),
      width: 80,
      connected: true,
    }));
  } catch {
    return [];
  }
}

export async function requestUsbPrinter(): Promise<PrinterConfig | null> {
  if (!isUsbAvailable()) {
    return null;
  }

  try {
    const device = await (navigator as any).usb.requestDevice({
      filters: USB_REQUEST_FILTERS,
    });

    return {
      name: device.productName || "Thermal Printer (USB)",
      connectionType: "usb",
      deviceId: device.serialNumber,
      vendorId: String(device.vendorId),
      productId: String(device.productId),
      width: 80,
      connected: true,
    };
  } catch {
    return null;
  }
}

async function hydrateSerialPort(config?: PrinterConfig): Promise<any> {
  if (serialPort) {
    return serialPort;
  }

  if (!config) {
    return null;
  }

  if (!isSerialAvailable()) {
    return null;
  }

  const serialNavigator = (navigator as any).serial as {
    getPorts?: () => Promise<any[]>;
  };

  if (typeof serialNavigator.getPorts !== "function") {
    return null;
  }

  try {
    const ports = await serialNavigator.getPorts();

    if (!config.vendorId || !config.productId) {
      return null;
    }

    const vendorId = Number(config.vendorId);
    const productId = Number(config.productId);

    if (!Number.isFinite(vendorId) || !Number.isFinite(productId)) {
      return null;
    }

    const matched =
      ports.find((port: any) => {
        const info = typeof port.getInfo === "function" ? port.getInfo() : {};
        return info.usbVendorId === vendorId && info.usbProductId === productId;
      }) ?? null;

    serialPort = matched;
    return matched;
  } catch {
    return null;
  }
}

export async function getAvailableSerialPrinters(): Promise<PrinterConfig[]> {
  if (!isSerialAvailable()) {
    return [];
  }

  const serialNavigator = (navigator as any).serial as {
    getPorts?: () => Promise<any[]>;
  };

  if (typeof serialNavigator.getPorts !== "function") {
    return [];
  }

  try {
    const ports = await serialNavigator.getPorts();

    return ports.map((port: any, index: number) => {
      const info = typeof port.getInfo === "function" ? port.getInfo() : {};
      const vendorId = info.usbVendorId ? String(info.usbVendorId) : undefined;
      const productId = info.usbProductId
        ? String(info.usbProductId)
        : undefined;

      const nameParts = ["Serial Printer"];
      if (vendorId && productId) {
        nameParts.push("VID " + vendorId + " PID " + productId);
      } else {
        nameParts.push("#" + (index + 1));
      }

      return {
        name: nameParts.join(" "),
        connectionType: "serial",
        vendorId,
        productId,
        serialBaudRate: 9600,
        width: 80,
        connected: true,
      };
    });
  } catch {
    return [];
  }
}

export async function requestSerialPrinter(
  baudRate: number = 9600,
): Promise<PrinterConfig | null> {
  if (!isSerialAvailable()) {
    return null;
  }

  try {
    const port = await (navigator as any).serial.requestPort();
    serialPort = port;

    const info = typeof port.getInfo === "function" ? port.getInfo() : {};
    const vendorId = info.usbVendorId ? String(info.usbVendorId) : undefined;
    const productId = info.usbProductId ? String(info.usbProductId) : undefined;

    const nameParts = ["Serial Printer"];
    if (vendorId && productId) {
      nameParts.push("VID " + vendorId + " PID " + productId);
    }

    return {
      name: nameParts.join(" "),
      connectionType: "serial",
      vendorId,
      productId,
      serialBaudRate: baudRate,
      width: 80,
      connected: true,
    };
  } catch {
    return null;
  }
}

export async function disconnectSerialPrinter(): Promise<void> {
  const port = serialPort;
  serialPort = null;

  if (!port) {
    return;
  }

  try {
    if (typeof port.close === "function") {
      await port.close();
    }
  } catch {
    // Ignore close failures.
  }
}

export async function sendSerialData(
  data: Uint8Array,
  config?: PrinterConfig,
): Promise<boolean> {
  if (!isSerialAvailable()) {
    return false;
  }

  const port = (await hydrateSerialPort(config)) ?? serialPort;
  if (!port) {
    return false;
  }

  try {
    if (!port.writable) {
      const baudRate = config?.serialBaudRate ?? 9600;
      await port.open({ baudRate });
    }

    const writer = port.writable.getWriter();
    try {
      const chunkSize = 256;
      for (let offset = 0; offset < data.length; offset += chunkSize) {
        await writer.write(data.slice(offset, offset + chunkSize));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      writer.releaseLock();
    }
    return true;
  } catch {
    try {
      await disconnectSerialPrinter();
    } catch {
      // Ignore disconnect errors.
    }
    return false;
  }
}
export function isBluetoothAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "bluetooth" in navigator
  );
}

/**
 * Detect whether the device is likely running Android.
 * RawBT is an Android app that bridges web apps to classic Bluetooth SPP
 * thermal printers via the `rawbt:` URL scheme.
 */
export function isRawBtAvailable(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /android/i.test(navigator.userAgent);
}

/**
 * Returns a summary of which connection types the current browser supports.
 */
export function getAvailableConnectionTypes(): Record<string, boolean> {
  return {
    usb: isUsbAvailable(),
    serial: isSerialAvailable(),
    bluetooth: isBluetoothAvailable(),
    rawbt: isRawBtAvailable(),
  };
}

/**
 * Send ESC/POS data to a thermal printer via the RawBT Android app.
 * RawBT registers the `rawbt:` URL scheme.  We encode the binary
 * payload as base64 and open `rawbt:base64,<data>`.
 */
export function sendViaRawBt(data: Uint8Array): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    let binary = "";
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    const encoded = btoa(binary);
    window.location.href = `rawbt:base64,${encoded}`;
    return true;
  } catch {
    return false;
  }
}

export async function getAvailableBluetoothPrinters(): Promise<
  PrinterConfig[]
> {
  const pairedDevices = getPairedBluetoothDevices();
  const pairedPrinterConfigs = pairedDevices.map((device) => ({
    name: device.name || "Paired Printer",
    connectionType: "bluetooth" as const,
    bluetoothDeviceId: device.id,
    width: 80,
    connected: false,
  }));

  if (!isBluetoothAvailable()) {
    return pairedPrinterConfigs;
  }

  let devices: PrinterConfig[] = [];
  const bluetoothNavigator = (navigator as any).bluetooth as {
    getDevices?: () => Promise<any[]>;
  };

  // Try to get devices from Web Bluetooth API (works on Android, Chrome)
  if (typeof bluetoothNavigator.getDevices === "function") {
    try {
      const apiDevices = await bluetoothNavigator.getDevices();
      devices = apiDevices.map((device: any) => ({
        name: device.name || "Bluetooth Printer",
        connectionType: "bluetooth",
        bluetoothDeviceId: device.id,
        width: 80,
        connected: false,
      }));
    } catch {
      // Ignore API errors
    }
  }

  // Merge, removing duplicates by ID
  const merged = [...devices];
  for (const paired of pairedPrinterConfigs) {
    if (!merged.find((d) => d.bluetoothDeviceId === paired.bluetoothDeviceId)) {
      merged.push(paired);
    }
  }

  return merged;
}

async function hydrateBluetoothDevice(config?: PrinterConfig): Promise<any> {
  if (bluetoothDevice) {
    return bluetoothDevice;
  }

  if (!config?.bluetoothDeviceId || !isBluetoothAvailable()) {
    return null;
  }

  const bluetoothNavigator = (navigator as any).bluetooth as {
    getDevices?: () => Promise<any[]>;
  };

  if (typeof bluetoothNavigator.getDevices !== "function") {
    return null;
  }

  const devices = await bluetoothNavigator.getDevices();
  const matchedDevice =
    devices.find((device: any) => device.id === config.bluetoothDeviceId) ??
    null;
  bluetoothDevice = matchedDevice;
  return matchedDevice;
}

export async function requestBluetoothPrinter(): Promise<PrinterConfig | null> {
  if (!isBluetoothAvailable()) {
    return null;
  }

  try {
    const device = await (navigator as any).bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: BT_PRINTER_SERVICE_UUIDS,
    });

    bluetoothDevice = device;

    return {
      name: device.name || "Bluetooth Printer",
      connectionType: "bluetooth",
      bluetoothDeviceId: device.id,
      width: 80,
      connected: true,
    };
  } catch {
    return null;
  }
}

export async function connectBluetoothPrinter(config?: PrinterConfig) {
  if (!isBluetoothAvailable()) {
    return null;
  }

  const device = (await hydrateBluetoothDevice(config)) ?? bluetoothDevice;
  if (!device?.gatt) {
    return null;
  }

  try {
    const server = device.gatt.connected
      ? device.gatt
      : await device.gatt.connect();

    // Save device as paired for future use (especially important for iOS)
    if (device.id && device.name) {
      savePairedBluetoothDevice({
        id: device.id,
        name: device.name,
      });
    }

    for (const serviceUuid of BT_PRINTER_SERVICE_UUIDS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const characteristics = await service.getCharacteristics();
        const writableCharacteristic = characteristics.find(
          (characteristic: any) =>
            characteristic.properties.write ||
            characteristic.properties.writeWithoutResponse,
        );

        if (writableCharacteristic) {
          bluetoothCharacteristic = writableCharacteristic;
          return writableCharacteristic;
        }
      } catch {
        continue;
      }
    }

    const services = await server.getPrimaryServices();

    // Fallback: scan all accessible services for any writable characteristic.
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        const writable = characteristics.find(
          (characteristic: any) =>
            characteristic.properties.write ||
            characteristic.properties.writeWithoutResponse,
        );
        if (writable) {
          bluetoothCharacteristic = writable;
          return writable;
        }
      } catch {
        continue;
      }
    }

    // Last resort: try well-known characteristic UUIDs.
    for (const service of services) {
      for (const characteristicUuid of BT_PRINTER_CHAR_UUIDS) {
        try {
          const characteristic =
            await service.getCharacteristic(characteristicUuid);
          if (
            characteristic.properties.write ||
            characteristic.properties.writeWithoutResponse
          ) {
            bluetoothCharacteristic = characteristic;
            return characteristic;
          }
        } catch {
          continue;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function sendBluetoothData(
  data: Uint8Array,
  config?: PrinterConfig,
): Promise<boolean> {
  if (!bluetoothCharacteristic) {
    const characteristic = await connectBluetoothPrinter(config);
    if (!characteristic) {
      return false;
    }
  }

  try {
    const chunkSize = 200;
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize);
      if (bluetoothCharacteristic?.properties.writeWithoutResponse) {
        await bluetoothCharacteristic.writeValueWithoutResponse(chunk);
      } else if (bluetoothCharacteristic) {
        await bluetoothCharacteristic.writeValueWithResponse(chunk);
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    return true;
  } catch {
    return false;
  }
}

export function disconnectBluetoothPrinter(): void {
  if (bluetoothDevice?.gatt?.connected) {
    bluetoothDevice.gatt.disconnect();
  }
  bluetoothDevice = null;
  bluetoothCharacteristic = null;
}

/**
 * For iOS users: manually add a Bluetooth printer device
 * Allows users to enter device name/UUID when Web Bluetooth enumeration fails
 */
export function addManualBluetoothDevice(name: string): BluetoothDeviceInfo {
  const device: BluetoothDeviceInfo = {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: name || "Bluetooth Printer",
    savedManually: true,
  };
  savePairedBluetoothDevice(device);
  return device;
}

async function findUsbDevice(config: PrinterConfig): Promise<any> {
  if (!isUsbAvailable()) {
    return null;
  }

  const devices = await (navigator as any).usb.getDevices();
  return (
    devices.find((device: any) => {
      const matchesSerial =
        config.deviceId && device.serialNumber === config.deviceId;
      const matchesVendor =
        config.vendorId && String(device.vendorId) === config.vendorId;
      const matchesProduct =
        config.productId && String(device.productId) === config.productId;
      return Boolean(matchesSerial || (matchesVendor && matchesProduct));
    }) ??
    devices[0] ??
    null
  );
}

async function writeUsbData(device: any, data: Uint8Array): Promise<boolean> {
  try {
    if (!device.opened) {
      await device.open();
    }

    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const configuration = device.configuration;
    if (!configuration) {
      return false;
    }

    for (const iface of configuration.interfaces) {
      for (const alternate of iface.alternates) {
        const endpoint = alternate.endpoints.find(
          (candidate: any) => candidate.direction === "out",
        );
        if (!endpoint) {
          continue;
        }

        await device.claimInterface(iface.interfaceNumber);
        try {
          if (
            typeof alternate.alternateSetting === "number" &&
            iface.alternate &&
            alternate.alternateSetting !== iface.alternate.alternateSetting
          ) {
            await device.selectAlternateInterface(
              iface.interfaceNumber,
              alternate.alternateSetting,
            );
          }
        } catch {
          // Some devices do not support alternate selection.
        }
        await device.transferOut(endpoint.endpointNumber, data);
        await device.close();
        return true;
      }
    }
  } catch {
    try {
      if (device.opened) {
        await device.close();
      }
    } catch {
      // Ignore close failures.
    }
  }

  return false;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildPrintDocument(content: string, pageWidth: string, fontSize: string) {
  return `<!doctype html>
<html>
  <head>
    <title>Receipt Print</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @page { margin: 0; size: ${pageWidth} auto; }
      html, body { width: ${pageWidth}; }
      body { margin: 0; padding: 2mm; background: #ffffff; color: #000; box-sizing: border-box; }
      pre {
        margin: 0;
        white-space: pre;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: ${fontSize};
        line-height: 1.2;
        width: calc(${pageWidth} - 4mm);
        max-width: calc(${pageWidth} - 4mm);
        overflow: hidden;
        letter-spacing: 0;
        font-variant-numeric: tabular-nums;
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <pre>${escapeHtml(content)}</pre>
  </body>
</html>`;
}

function openIframePrintWindow(html: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  try {
    // On iOS, we need a more visible iframe so Safari properly renders & prints.
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.width = "100vw";
    iframe.style.height = "100vh";
    iframe.style.opacity = "0.01";
    iframe.style.pointerEvents = "none";
    iframe.style.border = "0";
    iframe.style.zIndex = "99999";
    document.body.appendChild(iframe);

    const frameWindow = iframe.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      iframe.remove();
      return false;
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    // Longer delay for iOS Safari to fully render the content.
    window.setTimeout(() => {
      try {
        frameWindow.focus();
        frameWindow.print();
      } finally {
        window.setTimeout(() => iframe.remove(), 3000);
      }
    }, 600);

    return true;
  } catch {
    return false;
  }
}

/**
 * Check whether the Web Share API is available (iOS Safari, Android Chrome, etc).
 */
export function isShareAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  );
}

/**
 * Share receipt text using the Web Share API.
 * On iOS this opens the native share sheet where the user can AirPrint,
 * copy to Notes, send via Messages/WhatsApp, etc.
 */
export async function shareReceiptText(
  content: string,
  billNumber: string,
): Promise<boolean> {
  if (!isShareAvailable()) {
    return false;
  }

  try {
    await navigator.share({
      title: `Receipt ${billNumber}`,
      text: content,
    });
    return true;
  } catch {
    // User cancelled or share failed — not an error.
    return false;
  }
}

export function openBrowserPrintWindow(
  content: string,
  layout: BillLayoutConfig = getBillLayoutConfig(),
): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const pageWidth =
    layout.paperWidth <= 58
      ? "58mm"
      : layout.paperWidth >= 110
        ? "110mm"
        : "80mm";
  const fontSize =
    layout.fontSize === "small"
      ? "10px"
      : layout.fontSize === "large"
        ? "13px"
        : "11px";
  const html = buildPrintDocument(content, pageWidth, fontSize);

  if (isIosBrowser()) {
    return openIframePrintWindow(html);
  }

  const printWindow = window.open("", "PRINT", "height=720,width=480");
  if (!printWindow) {
    return false;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 150);
  return true;
}

export async function sendPrintData(
  content: string,
  config: PrinterConfig,
  layout: BillLayoutConfig = getBillLayoutConfig(),
): Promise<boolean> {
  const lines = content.split(/\r?\n/);
  const data = new TextEncoder().encode(generateEscPos(lines, layout));

  if (config.connectionType === "bluetooth") {
    return sendBluetoothData(data, config);
  }

  if (config.connectionType === "serial") {
    return sendSerialData(data, config);
  }

  if (config.connectionType === "usb") {
    const device = await findUsbDevice(config);
    if (!device) {
      return false;
    }

    return writeUsbData(device, data);
  }

  if (config.connectionType === "rawbt") {
    return sendViaRawBt(data);
  }

  return false;
}

export async function printReceipt(
  bill: PrintableBillData,
  billNumber: string,
  printerConfig: PrinterConfig = getPrinterConfig(),
  layout: BillLayoutConfig = getBillLayoutConfig(),
): Promise<PrintTransportResult> {
  const content = buildReceiptText(
    bill,
    billNumber,
    layout,
    bill.paymentMethod,
  );
  const printedToDevice = await sendPrintData(content, printerConfig, layout);

  if (printedToDevice) {
    return "device";
  }

  // On Android, try the RawBT bridge before falling back to browser print.
  if (isRawBtAvailable() && printerConfig.connectionType !== "rawbt") {
    const lines = content.split(/\r?\n/);
    const data = new TextEncoder().encode(generateEscPos(lines, layout));
    if (sendViaRawBt(data)) {
      return "device";
    }
  }

  // On iOS, try browser print (iframe-based AirPrint trigger).
  // This is the most reliable path for iOS Safari.
  return openBrowserPrintWindow(content, layout) ? "browser" : "failed";
}
