import { STORE_WHATSAPP_NUMBER, type BillLayoutConfig } from "./printer";

type ShareableBill = {
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
  createdAt?: string;
  items?: Array<{
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
};

function normalizePhone(phone: string) {
  return phone.replace(/[^\d]/g, "");
}

function formatMessageDate(createdAt?: string) {
  const date = createdAt ? new Date(createdAt) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString("en-IN");
  }

  return date.toLocaleString("en-IN");
}

export function buildWhatsAppBillMessage(
  bill: ShareableBill,
  billNumber: string,
  billLayout: BillLayoutConfig,
  paymentMethod: string
) {
  const lines: string[] = [];
  const senderPhone =
    billLayout.whatsappSenderPhone ||
    billLayout.companyPhone ||
    STORE_WHATSAPP_NUMBER;

  lines.push(`${billLayout.companyName || "Clothing Store"} Bill`);
  lines.push(`Bill No: ${billNumber}`);
  lines.push(`Payment: ${paymentMethod.toUpperCase()}`);
  lines.push(`Date: ${formatMessageDate(bill.createdAt)}`);
  lines.push(`From: ${senderPhone}`);

  if (bill.items?.length) {
    lines.push("");
    lines.push("Items:");
    for (const item of bill.items) {
      lines.push(
        `- ${item.productName} x${item.quantity} | Rs ${item.price.toFixed(2)} | Rs ${item.total.toFixed(2)}`
      );
    }
  }

  lines.push("");
  lines.push(`Subtotal: Rs ${bill.totalAmount.toFixed(2)}`);
  lines.push(`Discount: Rs ${bill.discountAmount.toFixed(2)}`);
  lines.push(`Tax: Rs ${bill.taxAmount.toFixed(2)}`);
  lines.push(`Total: Rs ${bill.finalAmount.toFixed(2)}`);

  lines.push(`Store WhatsApp: ${senderPhone}`);

  lines.push("");
  lines.push(billLayout.footerText || "Thank you for shopping with us.");

  return lines.join("\n");
}

export function openWhatsAppShare(message: string, phone?: string) {
  const encodedMessage = encodeURIComponent(message);
  const normalizedPhone = phone ? normalizePhone(phone) : "";
  const url = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  const popup = window.open(url, "_blank", "noopener,noreferrer");

  if (!popup) {
    window.location.href = url;
    return false;
  }

  return true;
}
