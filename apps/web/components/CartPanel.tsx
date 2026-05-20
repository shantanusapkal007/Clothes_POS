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
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
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

  const toggleExpand = (productId: string) => {
    setExpandedItem(expandedItem === productId ? null : productId);
  };

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
                const isExpanded = expandedItem === item.productId;
                const manualDiscountLimit =
                  (line?.lineSubtotal ?? item.price * item.quantity) *
                  (1 - item.discountPercent / 100);

                return (
                  <motion.div
                    layout
                    key={item.productId}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 340, damping: 28 }}
                    className="overflow-hidden rounded-lg border border-outline-variant/30 bg-white/95 shadow-sm"
                  >
                    {/* Compact Row — always visible */}
                    <div
                      className="flex items-center gap-1.5 sm:gap-2 md:gap-3 p-2 sm:p-2.5 md:p-3 cursor-pointer active:bg-surface-container-low/50"
                      onClick={() => toggleExpand(item.productId)}
                    >
                      <div className="h-9 w-9 sm:h-10 sm:w-10 md:h-14 md:w-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-white/80">
                        <img
                          alt={item.name}
                          src={getProductImage(item.name)}
                          className="h-full w-full object-cover mix-blend-multiply opacity-90"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h5 className="truncate text-xs sm:text-sm md:text-base font-semibold text-on-surface">
                          {item.name}
                        </h5>
                        <p className="text-[8px] sm:text-[10px] md:text-xs font-bold text-primary">
                          ₹{item.price.toFixed(0)} x {item.quantity}
                          {item.discountPercent > 0 && (
                            <span className="ml-1 text-emerald-700">-{item.discountPercent}%</span>
                          )}
                        </p>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="cart-item-compact__stepper-btn h-8 w-8 sm:h-9 sm:w-9"
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

                        <span className="cart-item-compact__qty text-xs sm:text-sm">{item.quantity}</span>

                        <button
                          className="cart-item-compact__stepper-btn h-8 w-8 sm:h-9 sm:w-9"
                          onClick={() => updateItem(item.productId, "quantity", item.quantity + 1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm sm:text-base">add</span>
                        </button>
                      </div>

                      {/* Line total */}
                      <div className="cart-item-compact__total text-xs sm:text-sm md:text-base min-w-[50px] sm:min-w-[60px]">
                        ₹{line?.total.toFixed(0) ?? "0"}
                      </div>

                      {/* Expand arrow */}
                      <span className="material-symbols-outlined text-base sm:text-lg text-on-secondary-container/50 transition-transform duration-200 shrink-0"
                        style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                      >
                        expand_more
                      </span>
                    </div>

                    {/* Expanded Details — price, discount, tax editing */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-outline-variant/20 bg-surface-container-lowest/50 p-2 sm:p-3 space-y-2 sm:space-y-3">
                            <div className="grid grid-cols-2 gap-1 sm:gap-1.5 md:grid-cols-4 md:gap-2">
                              <label className="block">
                                <span className="mb-0.5 sm:mb-1 block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                                  Price
                                </span>
                                <input
                                  className="field-input-compact text-right tabular-nums text-xs"
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

                              <label className="block">
                                <span className="mb-0.5 sm:mb-1 block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                                  Disc %
                                </span>
                                <div className="flex gap-0.5 sm:gap-1">
                                  <button
                                    type="button"
                                    className={`shrink-0 rounded-md px-1 sm:px-2 py-1 sm:py-1.5 text-[8px] sm:text-[9px] font-bold transition ${
                                      item.discountPercent === 10
                                        ? "bg-primary text-on-primary"
                                        : "bg-surface-container-high text-secondary"
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
                                    className="field-input-compact text-right tabular-nums flex-1 text-xs"
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
                                <span className="mb-0.5 sm:mb-1 block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                                  Manual ₹
                                </span>
                                <input
                                  className="field-input-compact text-right tabular-nums text-xs"
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

                              <label className="block">
                                <span className="mb-0.5 sm:mb-1 block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                                  Tax %
                                </span>
                                <input
                                  className="field-input-compact text-right tabular-nums text-xs"
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
                            </div>

                            {/* Line summary */}
                            <div className="flex items-center justify-between text-[8px] sm:text-xs">
                              <span className="text-on-secondary-container">
                                Subtotal ₹{(line?.lineSubtotal ?? item.price * item.quantity).toFixed(2)}
                                {line && line.discountAmount > 0 && (
                                  <span className="ml-1 sm:ml-2 text-emerald-700 font-semibold">
                                    Saved ₹{line.discountAmount.toFixed(2)}
                                  </span>
                                )}
                              </span>
                              <span className="font-headline font-bold text-primary text-xs sm:text-sm">
                                ₹{line?.total.toFixed(2) ?? "0.00"}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
            <div className="rounded-lg border border-outline-variant/25 bg-white/90 p-2 sm:p-3 md:p-4 shadow-sm">
              <span className="mb-1.5 sm:mb-2 block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                Payment Method
              </span>
              <div className="grid grid-cols-4 gap-1 sm:gap-1.5 md:gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <motion.button
                    key={method.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex flex-col items-center gap-0.5 sm:gap-1 rounded-lg border py-2 sm:py-2.5 md:py-3 transition-all ${
                      paymentMethod === method.id
                        ? "border-primary bg-primary text-on-primary shadow-md"
                        : "border-outline-variant/25 bg-surface-container-lowest text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg sm:text-[20px]">{method.icon}</span>
                    <span className="text-[8px] sm:text-[10px] md:text-xs font-bold uppercase tracking-[0.12em]">
                      {method.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="relative block rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm">
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
            <div className="rounded-lg border border-primary/10 bg-primary/5 p-2 sm:p-3 md:p-4 shadow-sm">
              <span className="mb-1.5 sm:mb-2 block text-[8px] sm:text-[9px] md:text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
                Bill Discount
              </span>
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
                    onChange={(e) => updateBillDiscount("billDiscountPercent", parseFloat(e.target.value) || 0)}
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
                    onChange={(e) => updateBillDiscount("billManualDiscountAmount", parseFloat(e.target.value) || 0)}
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
              whileTap={checkoutPending || !canSendWhatsApp ? undefined : { scale: 0.99 }}
              onClick={() =>
                onCheckout({
                  paymentMethod,
                  customerPhone: customerPhone.trim(),
                  customerName: customerName.trim() || undefined,
                  sendWhatsApp: sendWhatsApp && Boolean(customerPhone.trim())
                })
              }
              disabled={checkoutPending || !canSendWhatsApp}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 sm:py-3.5 md:py-4 text-sm sm:text-base md:text-lg font-bold text-on-primary shadow-[0_12px_30px_rgba(15,118,110,0.2)] transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {checkoutPending ? "Processing..." : "Checkout"}
              <span className="material-symbols-outlined text-lg sm:text-xl">chevron_right</span>
            </motion.button>
          </motion.div>
        </>
      )}
    </div>
  );
}
