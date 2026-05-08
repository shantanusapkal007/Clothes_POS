export type Product = {
  id: string;
  name: string;
  category: string | null;
  barcode: string | null;
  price: number;
  costPrice: number;
  discountPercent: number;
  taxPercent: number;
  stock: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
};

export type CartItem = {
  productId: string;
  name: string;
  barcode: string | null;
  quantity: number;
  price: number;
  discountPercent: number;
  manualDiscountAmount: number;
  taxPercent: number;
  stock: number;
};

export type BillResponse = {
  id: string;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  finalAmount: number;
  paymentMethod: string;
  status: string;
  customerName: string | null;
  customerPhone: string | null;
  refundedAt: string | null;
  refundReason: string | null;
  createdAt: string;
  items: BillItemResponse[];
};

export type BillItemResponse = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  total: number;
};

export type RefundResponse = {
  id: string;
  billId: string;
  amount: number;
  reason: string | null;
  createdAt: string;
};
