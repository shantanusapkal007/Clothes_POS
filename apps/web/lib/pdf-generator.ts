import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BillLayoutConfig, PrintableBillData } from "./printer";

export async function generatePDFBill(
  bill: PrintableBillData,
  billNumber: string,
  layout: BillLayoutConfig,
  paymentMethod: string
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.width;
  
  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(layout.companyName || "Store Bill", pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  let startY = 28;
  if (layout.companyAddress) {
    doc.text(layout.companyAddress, pageWidth / 2, startY, { align: "center" });
    startY += 6;
  }
  if (layout.companyPhone) {
    doc.text(`Phone: ${layout.companyPhone}`, pageWidth / 2, startY, { align: "center" });
    startY += 6;
  }

  doc.setLineWidth(0.5);
  doc.line(14, startY, pageWidth - 14, startY);
  startY += 8;

  // Bill Info
  doc.setFont("helvetica", "bold");
  doc.text(`Bill No: ${billNumber}`, 14, startY);
  
  const dateStr = bill.createdAt 
    ? new Date(bill.createdAt).toLocaleString("en-IN")
    : new Date().toLocaleString("en-IN");
    
  doc.text(`Date: ${dateStr}`, pageWidth - 14, startY, { align: "right" });
  startY += 6;
  doc.text(`Payment: ${paymentMethod.toUpperCase()}`, 14, startY);
  startY += 8;

  // Table
  const tableData = bill.items.map((item) => {
    const qtyRate = `${item.quantity} x ${item.price.toFixed(2)}`;
    let details = [];
    if (item.discountPercent > 0) details.push(`Disc ${item.discountPercent}%`);
    if (item.manualDiscountAmount && item.manualDiscountAmount > 0) details.push(`Less ₹${item.manualDiscountAmount.toFixed(2)}`);
    if (item.taxPercent > 0) details.push(`Tax ${item.taxPercent}%`);
    
    return [
      item.productName + (details.length ? `\n(${details.join(" | ")})` : ""),
      qtyRate,
      `₹${item.total.toFixed(2)}`
    ];
  });

  autoTable(doc, {
    startY,
    head: [["Item Description", "Qty x Rate", "Amount"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [159, 18, 57] }, // primary theme color (rose-700)
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 40, halign: "right" },
    },
  });

  // Summary
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFont("helvetica", "normal");
  doc.text(`Subtotal:`, pageWidth - 54, finalY);
  doc.text(`₹${bill.totalAmount.toFixed(2)}`, pageWidth - 14, finalY, { align: "right" });
  
  let summaryY = finalY + 6;

  if (layout.showDiscountBreakdown && bill.discountAmount > 0) {
    doc.text(`Discount:`, pageWidth - 54, summaryY);
    doc.setTextColor(22, 163, 74); // green
    doc.text(`-₹${bill.discountAmount.toFixed(2)}`, pageWidth - 14, summaryY, { align: "right" });
    doc.setTextColor(0, 0, 0);
    summaryY += 6;
  }

  if (layout.showTaxBreakdown && bill.taxAmount > 0) {
    doc.text(`Tax:`, pageWidth - 54, summaryY);
    doc.text(`₹${bill.taxAmount.toFixed(2)}`, pageWidth - 14, summaryY, { align: "right" });
    summaryY += 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  summaryY += 2;
  doc.text(`Total Amount:`, pageWidth - 54, summaryY);
  doc.text(`₹${bill.finalAmount.toFixed(2)}`, pageWidth - 14, summaryY, { align: "right" });

  summaryY += 15;
  if (layout.footerText) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text(layout.footerText, pageWidth / 2, summaryY, { align: "center" });
  }

  return doc.output("blob");
}

export async function sharePDF(blob: Blob, filename: string): Promise<boolean> {
  const file = new File([blob], filename, { type: "application/pdf" });
  
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: filename,
        text: "Here is your bill.",
      });
      return true;
    } catch (e) {
      console.warn("Error sharing:", e);
      return false;
    }
  }
  return false;
}

export function downloadPDF(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
