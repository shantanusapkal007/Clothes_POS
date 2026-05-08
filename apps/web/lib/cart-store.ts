"use client";

import { create } from "zustand";
import type { CartItem, Product } from "../types";

type CartState = {
  items: CartItem[];
  billDiscountPercent: number;
  billManualDiscountAmount: number;
  addItem: (product: Product) => void;
  updateItem: (
    productId: string,
    field: "quantity" | "price" | "discountPercent" | "manualDiscountAmount" | "taxPercent",
    value: number
  ) => void;
  updateBillDiscount: (
    field: "billDiscountPercent" | "billManualDiscountAmount",
    value: number
  ) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
};

export const useCartStore = create<CartState>((set) => ({
  items: [],
  billDiscountPercent: 0,
  billManualDiscountAmount: 0,
  addItem: (product) =>
    set((state) => {
      const existing = state.items.find((item) => item.productId === product.id);
      if (existing) {
        return {
          items: state.items.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  quantity:
                    product.stock > 0
                      ? Math.min(item.quantity + 1, product.stock)
                      : item.quantity,
                  stock: product.stock
                }
              : item
          )
        };
      }

      return {
        items: [
          {
            productId: product.id,
            name: product.name,
            barcode: product.barcode,
            quantity: 1,
            price: product.price,
            discountPercent: product.discountPercent,
            manualDiscountAmount: 0,
            taxPercent: 0,
            stock: product.stock
          },
          ...state.items
        ]
      };
    }),
  updateItem: (productId, field, value) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.productId === productId
          ? {
              ...item,
              [field]:
                field === "quantity"
                  ? Math.max(
                      1,
                      Math.min(
                        Math.trunc(Number.isFinite(value) ? value : 1),
                        Math.max(item.stock, 1)
                      )
                    )
                  : Math.max(0, Number.isFinite(value) ? value : 0)
            }
          : item
      )
    })),
  updateBillDiscount: (field, value) =>
    set(() => ({
      [field]: Math.max(0, Number.isFinite(value) ? value : 0)
    })),
  removeItem: (productId) =>
    set((state) => ({
      items: state.items.filter((item) => item.productId !== productId)
    })),
  clearCart: () => set({ items: [], billDiscountPercent: 0, billManualDiscountAmount: 0 })
}));
