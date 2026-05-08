"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CartPanel, type CheckoutRequest } from "./CartPanel";
import { CreateProductModal } from "./CreateProductModal";
import { ProductGrid } from "./ProductGrid";
import { ScannerPanel } from "./ScannerPanel";
import { BillPrintPreview } from "./BillPrintPreview";
import { PrinterSettings } from "./PrinterSettings";
import { checkoutBill, createProduct, getProductByBarcode, getProducts } from "../lib/api";
import { calculateCart } from "../lib/cart-calculations";
import { useCartStore } from "../lib/cart-store";
import { parseBarcodeData, type BarcodeData } from "../lib/barcode-parser";
import { calculateCheckout } from "../lib/billing";
import {
  STORE_WHATSAPP_NUMBER,
  getBillLayoutConfig,
  getPrinterConfig,
  isIosBrowser,
  printReceipt
} from "../lib/printer";
import { buildWhatsAppBillMessage, openWhatsAppShare } from "../lib/whatsapp";
import { useStoreName } from "../lib/store-settings";
import type { Product } from "../types";

import { ProductSkeleton } from "./Skeleton";

export type BillDataWithProducts = Omit<ReturnType<typeof calculateCheckout>, "items"> & {
  items: Array<{
    productName: string;
    productId: string;
    quantity: number;
    price: number;
    discountPercent: number;
    manualDiscountAmount: number;
    taxPercent: number;
    lineSubtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    total: number;
  }>;
};

function createPreviewBillNumber() {
  return `PRE-${Date.now().toString().slice(-6)}`;
}

function describePrinterRoute() {
  const printerConfig = getPrinterConfig();
  if (!printerConfig.connected || printerConfig.connectionType === "none") {
    return isIosBrowser() ? "Safari print / AirPrint" : "Browser print fallback";
  }

  if (printerConfig.connectionType === "rawbt") {
    return "RawBT Android bridge";
  }

  return `${printerConfig.connectionType.toUpperCase()} printer: ${printerConfig.name}`;
}

type MobileView = "products" | "cart";

export function PosWorkspace() {
  const { addItem, items, clearCart, updateItem } = useCartStore();
  const storeName = useStoreName();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createBarcode, setCreateBarcode] = useState("");
  const [createSeed, setCreateSeed] = useState<BarcodeData | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [printerSettingsOpen, setPrinterSettingsOpen] = useState(false);
  const [billPreviewOpen, setBillPreviewOpen] = useState(false);
  const [billData, setBillData] = useState<BillDataWithProducts | null>(null);
  const [previewBillNumber, setPreviewBillNumber] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [mobileView, setMobileView] = useState<MobileView>("products");
  const [pendingWhatsApp, setPendingWhatsApp] = useState<{
    customerPhone: string;
    sendWhatsApp: boolean;
  }>({
    customerPhone: "",
    sendWhatsApp: false
  });

  const visibleProducts = useMemo(() => {
    if (!search.trim()) {
      return products;
    }

    const query = search.toLowerCase();
    return products.filter((product) =>
      [product.name, product.category || "", product.barcode || ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [products, search]);

  const cartSummary = useMemo(() => calculateCart(items), [items]);
  const printerStatus = useMemo(() => describePrinterRoute(), [printerSettingsOpen, billPreviewOpen]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const nextProducts = await getProducts();
      setProducts(nextProducts);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

  // Auto-clear messages after 4s
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [message]);

  const handleProductAdd = (product: Product) => {
    addItem(product);
    setMessage(`${product.name} added`);
    setError(null);
  };

  const handleBarcodeSubmit = async (barcode: string) => {
    if (!barcode.trim()) {
      return;
    }

    const barcodeData = parseBarcodeData(barcode.trim());

    try {
      const product = await getProductByBarcode(barcodeData.barcode);

      addItem(product);

      const cartItem = useCartStore
        .getState()
        .items.find((item) => item.productId === product.id);

      if (!cartItem) {
        setMessage(`${product.name} added to cart`);
      } else {
        if (barcodeData.price !== undefined) {
          updateItem(product.id, "price", barcodeData.price);
        }

        if (barcodeData.discount !== undefined) {
          updateItem(product.id, "discountPercent", barcodeData.discount);
        }

        if (barcodeData.quantity !== undefined && barcodeData.quantity > 0) {
          updateItem(product.id, "quantity", barcodeData.quantity);
        }

        const messageBits = [`${product.name} added`];
        if (barcodeData.price !== undefined) {
          messageBits.push(`price ₹${barcodeData.price.toFixed(2)}`);
        }
        if (barcodeData.discount !== undefined) {
          messageBits.push(`discount ${barcodeData.discount}%`);
        }
        if (barcodeData.quantity !== undefined && barcodeData.quantity > 1) {
          messageBits.push(`qty ${barcodeData.quantity}`);
        }

        setMessage(messageBits.join(" | "));
      }

      setError(null);
      setBarcodeInput("");
    } catch {
      setCreateBarcode(barcodeData.barcode);
      setCreateSeed(barcodeData);
      setCreateModalOpen(true);
      setMessage(null);
      setError("Barcode not found. Create the product and continue.");
    }
  };

  const handleCreateProduct = async (payload: {
    name: string;
    category?: string;
    barcode?: string;
    price: number;
    costPrice: number;
    stock: number;
    minStock: number;
    discountPercent: number;
    taxPercent: number;
  }) => {
    const product = await createProduct(payload);
    setProducts((current) => [product, ...current]);
    addItem(product);
    setBarcodeInput("");
    setMessage(`${product.name} created and added to cart`);
    setError(null);
    return product;
  };

  const handleCheckout = async ({
    paymentMethod,
    customerPhone,
    sendWhatsApp
  }: CheckoutRequest) => {
    try {
      setCheckoutPending(true);
      setError(null);
      setSelectedPaymentMethod(paymentMethod);
      setPendingWhatsApp({
        customerPhone,
        sendWhatsApp
      });

      const checkoutItems = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        discountPercent: item.discountPercent,
        manualDiscountAmount: item.manualDiscountAmount,
        taxPercent: item.taxPercent
      }));

      const summary = calculateCheckout(checkoutItems);
      const billItems = summary.items.map((summaryItem) => ({
        ...summaryItem,
        productName: items.find((item) => item.productId === summaryItem.productId)?.name || "Item"
      }));

      setBillData({
        ...summary,
        items: billItems
      });
      setPreviewBillNumber(createPreviewBillNumber());
      setBillPreviewOpen(true);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed");
    } finally {
      setCheckoutPending(false);
    }
  };

  const handleConfirmCheckout = async (shouldPrint: boolean) => {
    const printableBill = billData
      ? {
          ...billData,
          paymentMethod: selectedPaymentMethod
        }
      : null;

    try {
      setCheckoutPending(true);
      setError(null);

      const result = await checkoutBill(items, selectedPaymentMethod);
      const savedBillNumber = result.id.slice(0, 8).toUpperCase();
      const billLayout = getBillLayoutConfig();
      const savedPrintableBill = printableBill
        ? {
            ...printableBill,
            paymentMethod: selectedPaymentMethod,
            createdAt: result.createdAt
          }
        : null;
      let nextMessage = `Bill ${savedBillNumber} saved`;

      if (shouldPrint && savedPrintableBill) {
        const printRoute = await printReceipt(
          savedPrintableBill,
          savedBillNumber,
          getPrinterConfig(),
          billLayout
        );

        if (printRoute === "device") {
          nextMessage = `${nextMessage} - sent to printer`;
        } else if (printRoute === "browser") {
          nextMessage = `${nextMessage} - print preview opened`;
        } else {
          setError("Bill saved, but printing failed. Check the printer connection.");
        }
      }

      if (pendingWhatsApp.sendWhatsApp && pendingWhatsApp.customerPhone && savedPrintableBill) {
        const whatsAppMessage = buildWhatsAppBillMessage(
          savedPrintableBill,
          savedBillNumber,
          billLayout,
          selectedPaymentMethod
        );
        const opened = openWhatsAppShare(whatsAppMessage, pendingWhatsApp.customerPhone);
        nextMessage = opened
          ? `${nextMessage}. WhatsApp opened.`
          : `${nextMessage}. WhatsApp ready.`;
      }

      clearCart();
      setBillPreviewOpen(false);
      setBillData(null);
      setPreviewBillNumber("");
      setPendingWhatsApp({ customerPhone: "", sendWhatsApp: false });
      setMobileView("products");
      setMessage(nextMessage);
      await loadProducts();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Checkout failed");
    } finally {
      setCheckoutPending(false);
    }
  };

  return (
    <section className="pos-shell">
      {/* ─── Compact Header ─── */}
      <header className="z-30 flex items-center gap-2 border-b border-outline-variant/25 bg-white/90 px-3 py-2 backdrop-blur-sm sm:px-4 sm:py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-on-background sm:text-xl">
            {storeName}
          </h2>
        </div>

        {/* Desktop-only stats */}
        <div className="hidden items-center gap-3 md:flex">
          <span className="rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-bold tabular-nums text-on-secondary-container">
            {products.length} products
          </span>
          {items.length > 0 && (
            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold tabular-nums text-primary">
              Cart: {items.length} — ₹{cartSummary.finalAmount.toFixed(0)}
            </span>
          )}
        </div>

        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-white text-on-secondary-container transition active:scale-95"
          onClick={() => setPrinterSettingsOpen(true)}
          title="Settings"
          type="button"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>settings</span>
        </button>
      </header>

      {/* ─── Mobile Tab Switcher ─── */}
      <div className="block xl:hidden border-b border-outline-variant/20 bg-surface-dim px-3 py-2">
        <div className="mobile-tab-bar">
          <button
            type="button"
            className={`mobile-tab ${mobileView === "products" ? "mobile-tab--active" : "mobile-tab--inactive"}`}
            onClick={() => setMobileView("products")}
          >
            <span className="material-symbols-outlined text-[18px]">storefront</span>
            Products
          </button>
          <button
            type="button"
            className={`mobile-tab ${mobileView === "cart" ? "mobile-tab--active" : "mobile-tab--inactive"}`}
            onClick={() => setMobileView("cart")}
          >
            <span className="material-symbols-outlined text-[18px]">shopping_cart</span>
            Cart
            {items.length > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                {items.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── Main Content Area ─── */}
      <div className="flex flex-1 flex-col xl:flex-row xl:overflow-hidden">
        {/* ─── LEFT: Products Panel ─── */}
        <div className={`flex flex-col ${mobileView === "cart" ? "hidden xl:flex" : "flex"} xl:flex-1 xl:overflow-hidden xl:border-r xl:border-outline-variant/20`}>
          {/* Search — compact on mobile */}
          <div className="flex-shrink-0 border-b border-outline-variant/20 bg-surface-dim p-3 sm:p-4">
            <ScannerPanel
              barcodeInput={barcodeInput}
              setBarcodeInput={setBarcodeInput}
              onBarcodeSubmit={handleBarcodeSubmit}
            />
            <div className="mt-2">
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-white px-3 py-2">
                <span className="material-symbols-outlined text-on-secondary-container/40" style={{ fontSize: 18 }}>search</span>
                <input
                  className="flex-1 border-none bg-transparent text-sm text-on-surface placeholder:text-on-secondary-container/50 focus:outline-none focus:ring-0"
                  placeholder="Search products..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  style={{ fontSize: 16 }}
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="material-symbols-outlined text-on-secondary-container/40"
                    style={{ fontSize: 16 }}
                  >
                    close
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Product Grid — scrollable */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4" style={{ WebkitOverflowScrolling: "touch" }}>
            {loading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {Array.from({ length: 12 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : visibleProducts.length > 0 ? (
              <ProductGrid products={visibleProducts} onAdd={handleProductAdd} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/30 mb-3">
                  inventory_2
                </span>
                <p className="font-semibold text-on-surface">No products found</p>
                <p className="mt-1 text-sm text-on-secondary-container">
                  {search ? "Try adjusting your search" : "Add products to get started"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── RIGHT: Cart & Checkout Panel ─── */}
        <div className={`flex flex-col overflow-hidden ${mobileView === "products" ? "hidden xl:flex" : "flex"} xl:flex-1 xl:max-w-lg`}>
          {/* Cart Toolbar */}
          <div className="flex-shrink-0 border-b border-outline-variant/20 bg-surface-dim px-4 py-3 flex items-center justify-between sm:px-6">
            <h3 className="font-bold text-on-surface">Shopping Cart</h3>
            <button
              className="button button-secondary button-small"
              onClick={() => setPrinterSettingsOpen(true)}
              title="Configure printer and bill layout"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span className="hidden sm:inline">Printer</span>
            </button>
          </div>

          {/* Cart Content */}
          <div className="flex-1 overflow-y-auto">
            <CartPanel
              onCheckout={handleCheckout}
              checkoutPending={checkoutPending}
              onOpenPrinterSettings={() => setPrinterSettingsOpen(true)}
              storeWhatsAppNumber={STORE_WHATSAPP_NUMBER}
            />
          </div>

          {/* Cart Footer */}
          {items.length > 0 && (
            <div className="border-t border-outline-variant/20 bg-surface-dim p-4 space-y-3 sm:p-6">
              <button
                className="button button-primary w-full"
                onClick={() => void loadProducts()}
              >
                <span className="material-symbols-outlined">refresh</span>
                Reload Products
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Floating Cart Badge (mobile only) ─── */}
      {mobileView === "products" && items.length > 0 && (
        <button
          type="button"
          className="floating-cart-badge xl:hidden"
          onClick={() => setMobileView("cart")}
        >
          <span className="material-symbols-outlined text-xl">shopping_cart</span>
          <span>{items.length} — ₹{cartSummary.finalAmount.toFixed(0)}</span>
        </button>
      )}

      {/* ─── Status Messages ─── */}
      <AnimatePresence>
        {message ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-800 border border-green-200 shadow-lg"
          >
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-50 border border-red-200 p-4 shadow-lg max-w-sm"
        >
          <p className="text-sm font-medium text-red-800 mb-3">{error}</p>
          <button
            className="button button-secondary button-small w-full"
            type="button"
            onClick={() => void loadProducts()}
          >
            Retry
          </button>
        </motion.div>
      ) : null}

      {/* ─── Modals ─── */}
      <AnimatePresence>
      {billPreviewOpen && billData ? (
        <BillPrintPreview
          bill={billData}
          billNumber={previewBillNumber}
          paymentMethod={selectedPaymentMethod}
          printerStatus={printerStatus}
          whatsAppCustomerPhone={
            pendingWhatsApp.sendWhatsApp ? pendingWhatsApp.customerPhone : undefined
          }
          whatsappSenderPhone={STORE_WHATSAPP_NUMBER}
          confirmPending={checkoutPending}
          onConfirmCheckout={handleConfirmCheckout}
          onClose={() => {
            setBillPreviewOpen(false);
            setBillData(null);
            setPreviewBillNumber("");
            setCheckoutPending(false);
            setPendingWhatsApp({ customerPhone: "", sendWhatsApp: false });
          }}
        />
      ) : null}
      </AnimatePresence>

      <AnimatePresence>
      {printerSettingsOpen ? (
        <PrinterSettings onClose={() => setPrinterSettingsOpen(false)} />
      ) : null}
      </AnimatePresence>

      <CreateProductModal
        barcode={createBarcode}
        seed={createSeed}
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setCreateSeed(null);
        }}
        onCreate={handleCreateProduct}
      />
    </section>
  );
}
