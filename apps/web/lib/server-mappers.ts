import type { Bill, BillItem, Product, Refund } from "@prisma/client";

export function mapProduct(product: Product) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    barcode: product.barcode,
    price: Number(product.price),
    costPrice: Number(product.costPrice),
    discountPercent: Number(product.discountPercent),
    taxPercent: Number(product.taxPercent),
    stock: product.stock,
    minStock: product.minStock,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

export function mapBill(
  bill: Bill & {
    items?: BillItem[];
    refunds?: Refund[];
  }
) {
  return {
    id: bill.id,
    totalAmount: Number(bill.totalAmount),
    discountAmount: Number(bill.discountAmount),
    taxAmount: Number(bill.taxAmount),
    finalAmount: Number(bill.finalAmount),
    paymentMethod: bill.paymentMethod,
    status: bill.status,
    customerName: bill.customerName,
    customerPhone: bill.customerPhone,
    refundedAt: bill.refundedAt,
    refundReason: bill.refundReason,
    createdAt: bill.createdAt,
    items:
      bill.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: Number(item.price),
        discount: Number(item.discount),
        tax: Number(item.tax),
        total: Number(item.total),
        productName: item.productName
      })) ?? [],
    refunds:
      bill.refunds?.map((r) => ({
        id: r.id,
        billId: r.billId,
        amount: Number(r.amount),
        reason: r.reason,
        createdAt: r.createdAt
      })) ?? []
  };
}

