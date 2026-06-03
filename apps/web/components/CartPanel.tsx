"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState, useEffect } from "react";
import { calculateCart } from "../lib/cart-calculations";
import { useCartStore } from "../lib/cart-store";
import { getCustomers, type CustomerResponse } from "../lib/api";

export type CheckoutRequest = {
  paymentMethod: string;
  customerPhone: string;
  customerName?: string;
  sendWhatsApp: boolean;
};

interface CartPanelProps {
  onCheckout: (request: CheckoutRequest) => void;
  checkoutPending: boolean;
  onOpenPrinterSettings: () => void;
  storeWhatsAppNumber: string;
}

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash", icon: "payments" },
  { id: "credit", label: "Udhar", icon: "add_card" },
  { id: "card", label: "Card", icon: "credit_card" },
  { id: "upi", label: "UPI", icon: "qr_code_2" }
] as const;

export function CartPanel({
  onCheckout,
  checkoutPending,
  onOpenPrinterSettings,
  storeWhatsAppNumber
}: CartPanelProps) {
  const {
    items,
    billDiscountPercent,
    billManualDiscountAmount,
    removeItem,
    updateItem,
    updateBillDiscount,
    clearCart
  } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["id"]>("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  // Khata Customer Autocomplete states
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResponse | null>(null);

  // Fetch Khata Customers on mount
  useEffect(() => {
    getCustomers()
      .then((data) => {
        setCustomers(data || []);
      })
      .catch((err) => {
        console.error("Failed to fetch customers for auto-suggest", err);
      });
  }, []);

  // Filter customers based on input Name or Phone
  const filteredCustomers = useMemo(() => {
    if (!customerName && !customerPhone) return [];
    const lowerName = customerName.toLowerCase();
    return customers.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(lowerName);
      const phoneMatch = c.phone.includes(customerPhone);
      return nameMatch || phoneMatch;
    });
  }, [customers, customerName, customerPhone]);

  // Resolve matching customer from typed values to update balance alert
  useEffect(() => {
    const match = customers.find(
      (c) =>
        c.phone === customerPhone ||
        (c.name.toLowerCase() === customerName.toLowerCase() && customerName !== "")
    );
    setSelectedCustomer(match || null);
  }, [customerPhone, customerName, customers]);

  const handleSelectCustomer = (c: CustomerResponse) => {
    setCustomerName(c.name);
    setCustomerPhone(c.phone);
    setSelectedCustomer(c);
    setShowSuggestions(false);
    
    // Automatically enable whatsapp billing if a valid 10+ digit number is present
    const normalized = c.phone.replace(/[^\d]/g, "");
    if (normalized.length >= 10) {
      setSendWhatsApp(true);
    } else {
      setSendWhatsApp(false);
    }
  };

  const handlePhoneChange = (val: string) => {
    setCustomerPhone(val);
    const normalized = val.replace(/[^\d]/g, "");
    if (normalized.length >= 10) {
      setSendWhatsApp(true);
    } else {
      setSendWhatsApp(false);
    }
  };
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const summary = calculateCart(items, billDiscountPercent, billManualDiscountAmount);
  const lineMap = useMemo(
    () => new Map(summary.lines.map((line) => [line.productId, line])),
    [summary.lines]
  );
  const normalizedCustomerPhone = customerPhone.replace(/[^\d]/g, "");
  const canSendWhatsApp = !sendWhatsApp || normalizedCustomerPhone.length >= 10;

  const getProductImage = (name: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=ffe4e6&color=9f1239&size=128&font-size=0.32`;

  return (
    <div className="glass-panel flex h-full flex-col rounded-lg p-2 sm:p-4 md:p-6 xl:sticky xl:top-24">
      {/* Header */}
      <div className="mb-3 sm:mb-4 md:mb-6 flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1 sm:gap-2 font-headline text-base sm:text-lg md:text-2xl font-bold text-on-background">
            Checkout
            <button
              onClick={onOpenPrinterSettings}
              className="material-symbols-outlined rounded-lg p-0.5 sm:p-1 text-lg sm:text-[20px] md:text-[24px] text-secondary transition-colors hover:bg-surface-container-high hover:text-primary"
              title="Printer Settings"
              type="button"
            >
              print
            </button>
          </h3>
          <p className="mt-0.5 hidden text-[10px] sm:text-xs text-on-secondary-container md:block md:text-sm">
            Review quantities, pricing, and checkout.
          </p>
        </div>

        {items.length > 0 ? (
          <button
            onClick={clearCart}
            className="shrink-0 rounded-lg px-2 sm:px-3 py-1 text-[9px] sm:text-xs md:text-sm font-semibold text-primary transition-colors hover:bg-surface-container-high active:scale-95"
            type="button"
          >
            Clear
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-1 flex-col items-center justify-center py-6 sm:py-8 md:py-12 text-center opacity-60"
        >
          <span className="material-symbols-outlined mb-2 text-3xl sm:text-4xl md:text-5xl opacity-80">shopping_basket</span>
          <p className="text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-on-secondary-container">
            Cart is empty
          </p>
        </motion.div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="hide-scrollbar mb-3 sm:mb-4 md:mb-6 flex-1 space-y-1.5 sm:space-y-2 md:space-y-3 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {items.map((item) => {
                const line = lineMap.get(item.productId);

                return (
                  <motion.div
                    layout
                    key={item.productId}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 340, damping: 28 }}
                    className="overflow-hidden rounded-xl border border-outline-variant/30 bg-white shadow-sm hover:border-primary/30 transition-colors"
                  >
                    {/* Compact Row — tap to edit */}
                    <div
                      className="flex items-center gap-2 p-2.5 sm:p-3 cursor-pointer active:bg-surface-container-low/50 select-none"
                      onClick={() => setEditingItem(item.productId)}
                    >
                      <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-white/80">
                        <img
                          alt={item.name}
                          src={getProductImage(item.name)}
                          className="h-full w-full object-cover mix-blend-multiply opacity-90"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h5 className="truncate text-xs sm:text-sm font-extrabold text-on-surface">
                          {item.name}
                        </h5>
                        <p className="text-[10px] sm:text-xs font-bold text-primary flex items-center gap-1.5 mt-0.5">
                          ₹{item.price.toFixed(0)} × {item.quantity}
                          {item.discountPercent > 0 && (
                            <span className="rounded bg-emerald-50 px-1 text-[9px] font-black text-emerald-700">-{item.discountPercent}%</span>
                          )}
                        </p>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="cart-item-compact__stepper-btn h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 active:scale-90"
                          onClick={() => {
                            if (item.quantity <= 1) {
                              removeItem(item.productId);
                            } else {
                              updateItem(item.productId, "quantity", item.quantity - 1);
                            }
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm sm:text-base">
                            {item.quantity <= 1 ? "delete" : "remove"}
                          </span>
                        </button>

                        <span className="w-6 text-center text-xs sm:text-sm font-extrabold text-on-surface">{item.quantity}</span>

                        <button
                          className="cart-item-compact__stepper-btn h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-700 active:scale-90"
                          onClick={() => updateItem(item.productId, "quantity", item.quantity + 1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm sm:text-base">add</span>
                        </button>
                      </div>

                      {/* Line total */}
                      <div className="text-right text-xs sm:text-sm font-black tabular-nums text-on-surface min-w-[50px] sm:min-w-[60px]">
                        ₹{line?.total.toFixed(0) ?? "0"}
                      </div>

                      {/* Edit Icon */}
                      <span className="material-symbols-outlined text-sm sm:text-base text-primary/70 hover:text-primary transition-colors shrink-0 p-1"
                        title="Edit price/discount"
                      >
                        edit_note
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* ─── Checkout Section ─── */}
          <motion.div
            layout
            className="space-y-2 sm:space-y-3 md:space-y-4 border-t border-outline-variant/30 pt-3 sm:pt-4 md:pt-6"
          >
            {/* Payment Method */}
            <div className="rounded-2xl border border-slate-200/50 bg-white/90 p-3 sm:p-4 shadow-sm">
              <span className="mb-2 block text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                Payment Method
              </span>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <motion.button
                    key={method.id}
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 sm:py-3 transition-all duration-200 ${
                      paymentMethod === method.id
                        ? "border-primary bg-gradient-to-br from-primary to-indigo-600 text-white shadow-md shadow-primary/10 scale-102"
                        : "border-slate-200/60 bg-white/50 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg sm:text-[20px]">{method.icon}</span>
                    <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.12em]">
                      {method.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="relative block rounded-2xl border border-slate-200/50 bg-slate-50/50 p-4 shadow-sm backdrop-blur-sm">
              <span className="mb-2 block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                Customer Information
              </span>
              <div className="relative space-y-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-on-surface shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  placeholder="Customer Name (for Udhar)"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-semibold text-on-surface shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                  type="tel"
                  placeholder="Phone Number"
                  value={customerPhone}
                  onChange={(e) => {
                    handlePhoneChange(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />

                {/* Suggestions Autocomplete Dropdown */}
                {showSuggestions && filteredCustomers.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setShowSuggestions(false)} 
                    />
                    <div className="absolute left-0 right-0 z-50 top-full mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200/60 bg-white/95 backdrop-blur-xl shadow-lg p-1.5 space-y-0.5 scrollbar-thin">
                      <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 flex justify-between items-center">
                        <span>Suggested Khata Customers</span>
                        <button 
                          type="button" 
                          onClick={() => setShowSuggestions(false)}
                          className="text-slate-400 hover:text-slate-600 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                      {filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => handleSelectCustomer(c)}
                          className="flex items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-primary/5 hover:text-primary cursor-pointer transition-all duration-150"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-bold truncate text-slate-800">{c.name}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{c.phone}</p>
                          </div>
                          {c.balance > 0 && (
                            <span className="shrink-0 ml-2 rounded-lg bg-amber-50 px-2 py-0.5 text-[9px] font-extrabold text-amber-700 border border-amber-200/50">
                              ₹{c.balance.toFixed(0)} Udhar
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Outstanding Balance Banner */}
              {selectedCustomer && selectedCustomer.balance > 0 && (
                <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-amber-200/50 bg-amber-50/80 px-3 py-2.5 text-xs font-bold text-amber-800 shadow-sm transition-all duration-200">
                  <span className="material-symbols-outlined text-amber-700 text-base animate-bounce" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                  <span>Outstanding Khata Balance: ₹{selectedCustomer.balance.toFixed(2)}</span>
                </div>
              )}

              <div className="mt-3 flex cursor-pointer items-center gap-2 border-t border-slate-200 pt-3">
                <input
                  className="rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                  type="checkbox"
                  id="whatsapp-check"
                  checked={sendWhatsApp}
                  onChange={(event) => setSendWhatsApp(event.target.checked)}
                />
                <label htmlFor="whatsapp-check" className="cursor-pointer">
                  <span className="block text-[10px] sm:text-xs font-bold text-emerald-900">
                    Send bill on WhatsApp
                  </span>
                </label>
              </div>
            </div>

            {/* Global Bill Discounts */}
            <div className="rounded-xl border border-primary/10 bg-primary/5 p-3 sm:p-4 shadow-sm">
              <span className="mb-2 block text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-primary">
                Bill Discount
              </span>
              
              {/* Quick Global Discounts Pill Row */}
              <div className="mb-2.5 flex flex-wrap gap-1">
                {[5, 10, 15].map((pct) => (
                  <button
                    key={`${pct}%`}
                    type="button"
                    onClick={() => {
                      updateBillDiscount("billDiscountPercent", pct);
                      updateBillDiscount("billManualDiscountAmount", 0); // clear other
                    }}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-all duration-150 active:scale-95 ${
                      billDiscountPercent === pct
                        ? "bg-primary text-white shadow-sm"
                        : "bg-white text-primary border border-primary/20 hover:bg-primary/5"
                    }`}
                  >
                    {pct}% Off
                  </button>
                ))}
                {[50, 100, 200].map((amt) => (
                  <button
                    key={`₹${amt}`}
                    type="button"
                    onClick={() => {
                      updateBillDiscount("billManualDiscountAmount", amt);
                      updateBillDiscount("billDiscountPercent", 0); // clear other
                    }}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold transition-all duration-150 active:scale-95 ${
                      billManualDiscountAmount === amt
                        ? "bg-primary text-white shadow-sm"
                        : "bg-white text-primary border border-primary/20 hover:bg-primary/5"
                    }`}
                  >
                    ₹{amt} Off
                  </button>
                ))}
                {(billDiscountPercent > 0 || billManualDiscountAmount > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      updateBillDiscount("billDiscountPercent", 0);
                      updateBillDiscount("billManualDiscountAmount", 0);
                    }}
                    className="rounded-full bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 text-[10px] font-extrabold hover:bg-red-100 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/40">%</span>
                  <input
                    className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-xs sm:text-sm font-bold tabular-nums text-on-surface shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Bill %"
                    value={billDiscountPercent || ""}
                    onChange={(e) => {
                      updateBillDiscount("billDiscountPercent", parseFloat(e.target.value) || 0);
                      if (parseFloat(e.target.value) > 0) {
                        updateBillDiscount("billManualDiscountAmount", 0); // clear flat
                      }
                    }}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-primary/40">₹</span>
                  <input
                    className="w-full rounded-lg border border-primary/20 bg-white pl-6 pr-3 py-2 text-xs sm:text-sm font-bold tabular-nums text-on-surface shadow-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                    type="number"
                    min={0}
                    placeholder="Manual ₹"
                    value={billManualDiscountAmount || ""}
                    onChange={(e) => {
                      updateBillDiscount("billManualDiscountAmount", parseFloat(e.target.value) || 0);
                      if (parseFloat(e.target.value) > 0) {
                        updateBillDiscount("billDiscountPercent", 0); // clear pct
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="rounded-lg border border-outline-variant/25 bg-white/90 p-2 sm:p-3 md:p-4 shadow-sm">
              <div className="space-y-1 sm:space-y-2">
                <div className="flex items-center justify-between gap-2 sm:gap-3 text-[9px] sm:text-xs md:text-sm">
                  <span className="text-on-secondary-container">Subtotal</span>
                  <span className="font-semibold tabular-nums text-on-surface">
                    ₹{summary.totalAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 sm:gap-3 text-[9px] sm:text-xs md:text-sm">
                  <span className="text-on-secondary-container">Discounts</span>
                  <span className="font-semibold tabular-nums text-emerald-700">
                    -₹{summary.discountAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 sm:gap-3 text-[9px] sm:text-xs md:text-sm">
                  <span className="text-on-secondary-container">Tax</span>
                  <span className="font-semibold tabular-nums text-on-surface">
                    +₹{summary.taxAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-2 sm:gap-3 border-t border-outline-variant/20 pt-1.5 sm:pt-2">
                  <div>
                    <span className="block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                      Payable
                    </span>
                  </div>
                  <span className="font-headline text-lg sm:text-xl md:text-2xl font-bold tabular-nums text-primary">
                    ₹{summary.finalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Checkout Button */}
            <motion.button
              type="button"
              whileTap={checkoutPending || !canSendWhatsApp ? undefined : { scale: 0.98 }}
              onClick={() =>
                onCheckout({
                  paymentMethod,
                  customerPhone: customerPhone.trim(),
                  customerName: customerName.trim() || "",
                  sendWhatsApp: sendWhatsApp && Boolean(customerPhone.trim())
                })
              }
              disabled={checkoutPending || !canSendWhatsApp}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary via-indigo-600 to-violet-600 py-3.5 sm:py-4 text-sm sm:text-base font-black text-white shadow-[0_10px_25px_rgba(99,102,241,0.25)] hover:shadow-[0_15px_30px_rgba(99,102,241,0.35)] hover:scale-[1.01] active:scale-[0.97] transition-all disabled:opacity-50 disabled:scale-100 border border-indigo-500/25"
            >
              {checkoutPending ? "Processing..." : "Checkout"}
              <span className="material-symbols-outlined text-lg sm:text-xl">chevron_right</span>
            </motion.button>
          </motion.div>
        </>
      )}

      {/* Cart Item Edit Modal */}
      {editingItem && (() => {
        const item = items.find((i) => i.productId === editingItem);
        if (!item) return null;
        const line = lineMap.get(item.productId);
        const manualDiscountLimit =
          (line?.lineSubtotal ?? item.price * item.quantity) *
          (1 - item.discountPercent / 100);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm select-none">
            <div 
              className="fixed inset-0" 
              onClick={() => setEditingItem(null)} 
            />
            <div className="relative w-full max-w-sm sm:max-w-md rounded-2xl border border-outline-variant/30 bg-white p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h4 className="font-headline text-sm sm:text-base font-bold text-on-surface">Edit Cart Item</h4>
                  <p className="text-[11px] text-slate-500 font-medium truncate max-w-[200px] sm:max-w-[280px]">{item.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Unit Price (₹)
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-sm"
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.price}
                    onChange={(event) =>
                      updateItem(
                        item.productId,
                        "price",
                        parseFloat(event.target.value) || 0
                      )
                    }
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Discount (%)
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        className={`shrink-0 rounded-lg px-2.5 text-[10px] font-black transition-all ${
                          item.discountPercent === 10
                            ? "bg-primary text-white shadow-sm shadow-primary/20"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                        onClick={() =>
                          updateItem(
                            item.productId,
                            "discountPercent",
                            item.discountPercent === 10 ? 0 : 10
                          )
                        }
                      >
                        10%
                      </button>
                      <input
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-right shadow-sm"
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={item.discountPercent}
                        onChange={(event) =>
                          updateItem(
                            item.productId,
                            "discountPercent",
                            parseFloat(event.target.value) || 0
                          )
                        }
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                      Manual Disc (₹)
                    </span>
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 text-right shadow-sm"
                      type="number"
                      min={0}
                      max={Math.max(0, manualDiscountLimit)}
                      step="0.01"
                      value={item.manualDiscountAmount}
                      onChange={(event) =>
                        updateItem(
                          item.productId,
                          "manualDiscountAmount",
                          parseFloat(event.target.value) || 0
                        )
                      }
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Tax (%)
                  </span>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs sm:text-sm font-bold tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-sm"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={item.taxPercent}
                    onChange={(event) =>
                      updateItem(
                        item.productId,
                        "taxPercent",
                        parseFloat(event.target.value) || 0
                      )
                    }
                  />
                </label>

                <div className="border border-slate-100 rounded-xl bg-slate-50/50 p-3 space-y-1.5 mt-2 shadow-inner">
                  <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                    <span>Base Subtotal:</span>
                    <span className="font-extrabold text-slate-700">₹{(line?.lineSubtotal ?? item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  {line && line.discountAmount > 0 && (
                    <div className="flex justify-between text-[11px] text-emerald-700 font-medium">
                      <span>Discount Saved:</span>
                      <span className="font-black">-₹{line.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {line && line.taxAmount > 0 && (
                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                      <span>GST Tax ({item.taxPercent}%):</span>
                      <span className="font-extrabold text-slate-700">+₹{line.taxAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs font-black text-primary border-t border-dashed border-slate-200 pt-2 mt-1">
                    <span>Item Total:</span>
                    <span>₹{line?.total.toFixed(2) ?? "0.00"}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="w-full rounded-xl bg-primary py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-primary/20 hover:bg-primary-hover active:scale-95 transition-all"
                >
                  Save & Apply Changes
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
