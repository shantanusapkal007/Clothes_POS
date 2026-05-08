import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { calculateCart } from "../lib/cart-calculations";
import { useCartStore } from "../lib/cart-store";

export type CheckoutRequest = {
  paymentMethod: string;
  customerPhone: string;
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
  { id: "card", label: "Card", icon: "credit_card" },
  { id: "upi", label: "UPI", icon: "qr_code_2" }
] as const;

export function CartPanel({
  onCheckout,
  checkoutPending,
  onOpenPrinterSettings,
  storeWhatsAppNumber
}: CartPanelProps) {
  const { items, removeItem, updateItem, clearCart } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]["id"]>("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const summary = calculateCart(items);
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
    <div className="glass-panel flex h-full flex-col rounded-lg p-3 md:p-6 xl:sticky xl:top-24">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3 md:mb-6">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-headline text-lg font-bold text-on-background md:text-2xl">
            Checkout
            <button
              onClick={onOpenPrinterSettings}
              className="material-symbols-outlined rounded-lg p-1 text-[20px] text-secondary transition-colors hover:bg-surface-container-high hover:text-primary md:text-[24px]"
              title="Printer Settings"
              type="button"
            >
              print
            </button>
          </h3>
          <p className="mt-0.5 hidden text-xs text-on-secondary-container sm:block md:text-sm">
            Review quantities, pricing, and checkout.
          </p>
        </div>

        {items.length > 0 ? (
          <button
            onClick={clearCart}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-surface-container-high active:scale-95 md:text-sm"
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
          className="flex flex-1 flex-col items-center justify-center py-8 text-center opacity-60 md:py-12"
        >
          <span className="material-symbols-outlined mb-2 text-4xl opacity-80 md:mb-3 md:text-5xl">shopping_basket</span>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-secondary-container md:text-sm">
            Cart is empty
          </p>
        </motion.div>
      ) : (
        <>
          {/* Cart Items */}
          <div className="hide-scrollbar mb-4 flex-1 space-y-2 overflow-y-auto pr-1 md:mb-6 md:space-y-3">
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
                      className="flex items-center gap-2 p-2.5 cursor-pointer active:bg-surface-container-low/50 md:gap-3 md:p-3"
                      onClick={() => toggleExpand(item.productId)}
                    >
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-white/80 md:h-14 md:w-14">
                        <img
                          alt={item.name}
                          src={getProductImage(item.name)}
                          className="h-full w-full object-cover mix-blend-multiply opacity-90"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h5 className="truncate text-sm font-semibold text-on-surface md:text-base">
                          {item.name}
                        </h5>
                        <p className="text-[10px] font-bold text-primary md:text-xs">
                          Rs {item.price.toFixed(0)} x {item.quantity}
                          {item.discountPercent > 0 && (
                            <span className="ml-1 text-emerald-700">-{item.discountPercent}%</span>
                          )}
                        </p>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="cart-item-compact__stepper-btn"
                          onClick={() => {
                            if (item.quantity <= 1) {
                              removeItem(item.productId);
                            } else {
                              updateItem(item.productId, "quantity", item.quantity - 1);
                            }
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {item.quantity <= 1 ? "delete" : "remove"}
                          </span>
                        </button>

                        <span className="cart-item-compact__qty">{item.quantity}</span>

                        <button
                          className="cart-item-compact__stepper-btn"
                          onClick={() => updateItem(item.productId, "quantity", item.quantity + 1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[16px]">add</span>
                        </button>
                      </div>

                      {/* Line total */}
                      <div className="cart-item-compact__total">
                        Rs {line?.total.toFixed(0) ?? "0"}
                      </div>

                      {/* Expand arrow */}
                      <span className="material-symbols-outlined text-[18px] text-on-secondary-container/50 transition-transform duration-200"
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
                          <div className="border-t border-outline-variant/20 bg-surface-container-lowest/50 p-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <label className="block">
                                <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                                  Price
                                </span>
                                <input
                                  className="field-input-compact text-right tabular-nums"
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
                                <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                                  Disc %
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className={`shrink-0 rounded-md px-2 py-1.5 text-[9px] font-bold transition ${
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
                                    className="field-input-compact text-right tabular-nums flex-1"
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
                                <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                                  Manual Rs
                                </span>
                                <input
                                  className="field-input-compact text-right tabular-nums"
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
                                <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.15em] text-on-secondary-container">
                                  Tax %
                                </span>
                                <input
                                  className="field-input-compact text-right tabular-nums"
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
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-on-secondary-container">
                                Subtotal Rs {(line?.lineSubtotal ?? item.price * item.quantity).toFixed(2)}
                                {line && line.discountAmount > 0 && (
                                  <span className="ml-2 text-emerald-700 font-semibold">
                                    Saved Rs {line.discountAmount.toFixed(2)}
                                  </span>
                                )}
                              </span>
                              <span className="font-headline font-bold text-primary text-base">
                                Rs {line?.total.toFixed(2) ?? "0.00"}
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
            className="space-y-3 border-t border-outline-variant/30 pt-4 md:space-y-4 md:pt-6"
          >
            {/* Payment Method */}
            <div className="rounded-lg border border-outline-variant/25 bg-white/90 p-3 shadow-sm md:p-4">
              <span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.15em] text-on-secondary-container md:text-[10px]">
                Payment Method
              </span>
              <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <motion.button
                    key={method.id}
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex flex-col items-center gap-1 rounded-lg border py-2.5 transition-all md:py-3 ${
                      paymentMethod === method.id
                        ? "border-primary bg-primary text-on-primary shadow-md"
                        : "border-outline-variant/25 bg-surface-container-lowest text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">{method.icon}</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] md:text-xs">
                      {method.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>

            {/* WhatsApp Toggle */}
            <label className="block rounded-lg border border-emerald-200/70 bg-emerald-50/85 p-3 shadow-sm md:p-4">
              <div className="flex cursor-pointer items-start gap-2.5">
                <input
                  className="mt-1 rounded border-emerald-300 text-emerald-700 focus:ring-emerald-600"
                  type="checkbox"
                  checked={sendWhatsApp}
                  onChange={(event) => setSendWhatsApp(event.target.checked)}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-emerald-900 md:text-sm">
                    Send bill on WhatsApp
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-emerald-800/80 md:text-xs">
                    Uses {storeWhatsAppNumber}
                  </span>
                </span>
              </div>

              <input
                className="mt-2 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-sm text-on-surface shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-emerald-50 disabled:text-emerald-900/40"
                type="tel"
                inputMode="tel"
                placeholder="Customer WhatsApp number"
                value={customerPhone}
                disabled={!sendWhatsApp}
                onChange={(event) => setCustomerPhone(event.target.value)}
              />
              {sendWhatsApp && !canSendWhatsApp ? (
                <p className="mt-1.5 text-[10px] font-medium text-error md:text-xs">
                  Enter the customer&apos;s WhatsApp number.
                </p>
              ) : null}
            </label>

            {/* Order Summary */}
            <div className="rounded-lg border border-outline-variant/25 bg-white/90 p-3 shadow-sm md:p-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 text-xs md:text-sm">
                  <span className="text-on-secondary-container">Subtotal</span>
                  <span className="font-semibold tabular-nums text-on-surface">
                    Rs {summary.totalAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs md:text-sm">
                  <span className="text-on-secondary-container">Discounts</span>
                  <span className="font-semibold tabular-nums text-emerald-700">
                    -Rs {summary.discountAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs md:text-sm">
                  <span className="text-on-secondary-container">Tax</span>
                  <span className="font-semibold tabular-nums text-on-surface">
                    +Rs {summary.taxAmount.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-3 border-t border-outline-variant/20 pt-2">
                  <div>
                    <span className="block text-[9px] font-bold uppercase tracking-[0.15em] text-on-secondary-container md:text-[10px]">
                      Payable
                    </span>
                  </div>
                  <span className="font-headline text-xl font-bold tabular-nums text-primary md:text-2xl">
                    Rs {summary.finalAmount.toFixed(2)}
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
                  sendWhatsApp: sendWhatsApp && Boolean(customerPhone.trim())
                })
              }
              disabled={checkoutPending || !canSendWhatsApp}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-base font-bold text-on-primary shadow-[0_12px_30px_rgba(15,118,110,0.2)] transition-all active:scale-[0.98] disabled:opacity-50 md:py-4 md:text-lg"
            >
              {checkoutPending ? "Processing..." : "Checkout"}
              <span className="material-symbols-outlined text-xl">chevron_right</span>
            </motion.button>
          </motion.div>
        </>
      )}
    </div>
  );
}
