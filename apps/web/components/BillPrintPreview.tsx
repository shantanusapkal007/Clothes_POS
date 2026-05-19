"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  buildReceiptText,
  getBillLayoutConfig,
  isIosBrowser,
  isShareAvailable,
  shareReceiptText
} from "../lib/printer";
import { generatePDFBill, sharePDF, downloadPDF } from "../lib/pdf-generator";
import type { BillDataWithProducts } from "./PosWorkspace";

interface BillPrintPreviewProps {
  bill: BillDataWithProducts;
  billNumber: string;
  paymentMethod: string;
  printerStatus: string;
  whatsAppCustomerPhone?: string;
  whatsappSenderPhone?: string;
  onConfirmCheckout: (shouldPrint: boolean) => void;
  onClose: () => void;
  confirmPending?: boolean;
}

export function BillPrintPreview({
  bill,
  billNumber,
  paymentMethod,
  printerStatus,
  whatsAppCustomerPhone,
  whatsappSenderPhone,
  onConfirmCheckout,
  onClose,
  confirmPending
}: BillPrintPreviewProps) {
  const layout = getBillLayoutConfig();
  const iosBrowser = isIosBrowser();
  const shareAvailable = isShareAvailable();
  const receiptFontSize =
    layout.fontSize === "small"
      ? "10px"
      : layout.fontSize === "large"
        ? "13px"
        : "11px";

  const receiptContent = buildReceiptText(
    { ...bill, paymentMethod },
    billNumber,
    layout,
    paymentMethod
  );

  const confirmPrintLabel = whatsAppCustomerPhone
    ? iosBrowser
      ? "Confirm & AirPrint + WhatsApp"
      : "Confirm & Print + WhatsApp"
    : iosBrowser
      ? "Confirm & AirPrint"
      : "Confirm & Print";

  const confirmSaveLabel = whatsAppCustomerPhone
    ? "Save & WhatsApp"
    : "Save only";

  const [pdfError, setPdfError] = useState<string | null>(null);

  const handleShare = async () => {
    await shareReceiptText(receiptContent, billNumber);
  };

  const handlePdfAction = async (action: "download" | "share") => {
    try {
      setPdfError(null);
      const pdfBlob = await generatePDFBill(bill, billNumber, layout, paymentMethod);
      const filename = `Bill_${billNumber}.pdf`;
      
      if (action === "share") {
        const shared = await sharePDF(pdfBlob, filename);
        if (!shared) {
          // Fallback if sharing is not supported/failed
          downloadPDF(pdfBlob, filename);
        }
      } else {
        downloadPDF(pdfBlob, filename);
      }
    } catch (err) {
      console.error(err);
      setPdfError("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-[#042f2e]/40 backdrop-blur-md"
        onClick={confirmPending ? undefined : onClose}
      />

      {/* Bottom sheet / modal */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-[111] flex max-h-[95vh] flex-col rounded-t-2xl bg-white shadow-[0_-20px_60px_rgba(8,47,40,0.2)] sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[90vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Drag handle (mobile) */}
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-outline-variant/40 sm:hidden" />

        {/* Close button */}
        <div className="flex items-center justify-between px-4 pt-2 pb-2 sm:pt-4">
          <div className="text-xs text-on-secondary-container">
            <span className="font-semibold uppercase tracking-[0.15em]">Print via </span>
            <span>{printerStatus}</span>
          </div>
          <button
            className="material-symbols-outlined cursor-pointer rounded-lg p-1.5 text-secondary transition-colors hover:text-error"
            onClick={onClose}
            disabled={confirmPending}
            type="button"
          >
            close
          </button>
        </div>

        {/* iOS / WhatsApp info */}
        {(iosBrowser || whatsAppCustomerPhone) && (
          <div className="border-t border-outline-variant/20 px-4 py-2 text-[10px] text-on-secondary-container space-y-1 md:text-xs">
            {iosBrowser && (
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-blue-600">phone_iphone</span>
                AirPrint will open via Safari print sheet
              </p>
            )}
            {whatsAppCustomerPhone && (
              <p className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px] text-emerald-600">chat</span>
                WhatsApp: {whatsappSenderPhone ? `${whatsappSenderPhone} → ` : ""}{whatsAppCustomerPhone}
              </p>
            )}
          </div>
        )}

        {/* Receipt Preview */}
        <div className="flex-1 overflow-y-auto border-t border-outline-variant/20 bg-surface-container-lowest px-3 py-4 sm:px-4">
          <div className="hide-scrollbar overflow-x-auto rounded-lg border border-outline-variant/20 bg-[#f8fcfb] p-2">
            <div
              className="mx-auto rounded-lg border border-outline-variant/20 bg-white p-3 shadow-sm"
              style={{ width: `${layout.paperWidth || 80}mm`, maxWidth: "100%" }}
            >
              <pre
                className="m-0 whitespace-pre font-mono text-black"
                style={{
                  fontSize: receiptFontSize,
                  lineHeight: 1.2,
                  letterSpacing: 0,
                  fontVariantNumeric: "tabular-nums",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                }}
              >
                {receiptContent}
              </pre>
            </div>
          </div>
        </div>

        {/* Action Buttons — sticky bottom */}
        <div className="shrink-0 space-y-2 border-t border-outline-variant/30 bg-white p-3 pb-safe sm:p-4">
          
          {pdfError && (
            <div className="mb-2 rounded-lg bg-red-50 p-2 text-center text-xs font-medium text-red-600">
              {pdfError}
            </div>
          )}

          {/* Primary: Print & Confirm */}
          <button
            onClick={() => onConfirmCheckout(true)}
            disabled={confirmPending}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-sm font-bold text-on-primary shadow-md transition-all active:scale-[0.98] disabled:opacity-60 md:py-4"
          >
            {confirmPending ? (
              <span className="material-symbols-outlined animate-spin text-lg">refresh</span>
            ) : (
              <span className="material-symbols-outlined text-lg">print</span>
            )}
            {confirmPending ? "Processing…" : confirmPrintLabel}
          </button>

          <div className="flex gap-2">
            {/* Share PDF or Text */}
            <button
              onClick={() => handlePdfAction(isShareAvailable() ? "share" : "download")}
              disabled={confirmPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant/30 py-2.5 text-xs font-bold text-primary transition active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
              {isShareAvailable() ? "Share PDF" : "Download PDF"}
            </button>

            {/* Save without printing */}
            <button
              onClick={() => onConfirmCheckout(false)}
              disabled={confirmPending}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-outline-variant/30 py-2.5 text-xs font-bold text-on-secondary-container transition active:scale-95"
            >
              {confirmSaveLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}
