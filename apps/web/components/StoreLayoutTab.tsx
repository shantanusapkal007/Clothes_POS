"use client";

import { useMemo, useState, type FormEvent } from "react";
import { buildReceiptText, type BillLayoutConfig, type PrinterConfig } from "../lib/printer";

interface StoreLayoutTabProps {
  billLayout: BillLayoutConfig;
  updateLayout: (partial: Partial<BillLayoutConfig>) => void;
  printerConfig: PrinterConfig;
  updatePrinter: (nextConfig: PrinterConfig) => void;
  handleSaveBillLayout: (event: FormEvent<HTMLFormElement>) => void;
}

export function StoreLayoutTab({
  billLayout,
  updateLayout,
  printerConfig,
  updatePrinter,
  handleSaveBillLayout,
}: StoreLayoutTabProps) {
  const [showPreview, setShowPreview] = useState(false);

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

  return (
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
  );
}
