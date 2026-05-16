"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { CartPanel, type CheckoutRequest } from "./CartPanel";
import { ProductGrid } from "./ProductGrid";
import { checkoutBill, createProduct, getProductByBarcode, getProducts } from "../lib/api";

const CreateProductModal = dynamic(() => import("./CreateProductModal").then(mod => mod.CreateProductModal));
const ScannerPanel = dynamic(() => import("./ScannerPanel").then(mod => mod.ScannerPanel));
const BillPrintPreview = dynamic(() => import("./BillPrintPreview").then(mod => mod.BillPrintPreview));
const PrinterSettings = dynamic(() => import("./PrinterSettings").then(mod => mod.PrinterSettings));
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
  const {
    addItem,
    items,
    billDiscountPercent,
    billManualDiscountAmount,
    clearCart,
    updateItem
  } = useCartStore();
  const storeName = useStoreName();
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState<number | null>(null);
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

  const cartSummary = useMemo(
    () => calculateCart(items, billDiscountPercent, billManualDiscountAmount),
    [items, billDiscountPercent, billManualDiscountAmount]
  );
  const printerStatus = useMemo(() => describePrinterRoute(), [printerSettingsOpen, billPreviewOpen]);

  const loadProducts = async (page = 1) => {
    try {
      setLoading(true);
      const { items, totalCount } = await getProducts({ page, pageSize: 20 });
      setProducts((prev) => (page === 1 ? items : [...prev, ...items]));
      setTotalCount(totalCount);
      setCurrentPage(page);
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

      const result = await checkoutBill(
        items,
        selectedPaymentMethod,
        billDiscountPercent,
        billManualDiscountAmount
      );
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
      <header className="z-30 flex items-center gap-2 border-b border-outline-variant/25 bg-white px-2.5 py-2 sm:px-4 sm:py-3 md:px-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-on-background sm:text-base md:text-xl">
            {storeName}
          </h2>
        </div>

        {/* Desktop-only stats */}
        <div className="hidden items-center gap-2 md:gap-3 md:flex">
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
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-outline-variant/30 bg-white text-on-secondary-container transition active:scale-95 touch-action-manipulation"
          onClick={() => setPrinterSettingsOpen(true)}
          title="Settings"
          type="button"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
        </button>
      </header>

      {/* ─── Mobile Tab Switcher ─── */}
      <div className="block xl:hidden border-b border-outline-variant/20 bg-surface-dim px-2 py-1.5 sm:px-3 sm:py-2">
        <div className="mobile-tab-bar">
          <button
            type="button"
            className={`mobile-tab ${mobileView === "products" ? "mobile-tab--active" : "mobile-tab--inactive"}`}
            onClick={() => setMobileView("products")}
          >
            <span className="material-symbols-outlined text-[20px]">storefront</span>
            <span className="hidden xs:inline">Products</span>
          </button>
          <button
            type="button"
            className={`mobile-tab ${mobileView === "cart" ? "mobile-tab--active" : "mobile-tab--inactive"}`}
            onClick={() => setMobileView("cart")}
          >
            <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
            <span className="hidden xs:inline">Cart</span>
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
        <div className={`flex flex-1 flex-col overflow-hidden ${mobileView === "cart" ? "hidden xl:flex" : "flex"} xl:border-r xl:border-outline-variant/20`}>
          {/* Search — compact on mobile */}
          <div className="flex-shrink-0 border-b border-outline-variant/20 bg-surface-dim p-2 sm:p-3 md:p-4">
            <div className="flex items-center gap-2 rounded-lg border border-outline-variant/40 bg-white px-3 py-2.5 sm:rounded-xl sm:px-3 sm:py-2.5">
              <span className="material-symbols-outlined text-on-secondary-container/40 text-lg sm:text-xl" style={{ fontSize: 18 }}>search</span>
              <input
                className="flex-1 border-none bg-transparent text-xs sm:text-sm text-on-surface placeholder:text-on-secondary-container/50 focus:outline-none focus:ring-0"
                placeholder="Search..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ fontSize: 16 }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="material-symbols-outlined text-on-secondary-container/40 text-lg"
                  style={{ fontSize: 16 }}
                  type="button"
                >
                  close
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4" style={{ WebkitOverflowScrolling: "touch" }}>
            {loading ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 gap-2 md:gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <ProductSkeleton key={i} />
                ))}
              </div>
            ) : visibleProducts.length > 0 ? (
              <>
                <ProductGrid products={visibleProducts} onAdd={handleProductAdd} />
                {totalCount && products.length < totalCount && (
                  <button
                    className="mt-4 px-4 py-2 bg-primary text-white rounded"
                    onClick={() => loadProducts(currentPage + 1)}
                    disabled={loading}
                  >
                    {loading ? "Loading…" : "Load More"}
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center sm:py-12">
                <span className="material-symbols-outlined text-3xl sm:text-4xl text-on-surface-variant/30 mb-2 sm:mb-3">
                  inventory_2
                </span>
                <p className="font-semibold text-xs sm:text-sm text-on-surface">No products found</p>
                <p className="mt-0.5 sm:mt-1 text-xs text-on-secondary-container">
                  {search ? "Try adjusting your search" : "Add products to get started"}
                </p>
              </div>
            )}
          </div>

          {/* Scanner at the bottom */}
          <div className="flex-shrink-0 border-t border-outline-variant/20 bg-surface-dim p-2 sm:p-3 md:p-4">
            <ScannerPanel
              barcodeInput={barcodeInput}
              setBarcodeInput={setBarcodeInput}
              onBarcodeSubmit={handleBarcodeSubmit}
            />
          </div>
        </div>

        {/* ─── RIGHT: Cart & Checkout Panel ─── */}
        <div className={`flex flex-col overflow-hidden ${mobileView === "products" ? "hidden xl:flex" : "flex"} xl:flex-1 xl:max-w-lg`}>
          {/* Cart Toolbar */}
          <div className="flex-shrink-0 border-b border-outline-variant/20 bg-surface-dim px-2 py-2 sm:px-4 sm:py-3 flex items-center justify-between md:px-6">
            <h3 className="font-bold text-xs sm:text-sm text-on-surface md:text-base">Shopping Cart</h3>
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
            <div className="border-t border-outline-variant/20 bg-surface-dim p-2 sm:p-4 md:p-6 space-y-2 sm:space-y-3">
              <button
                className="button button-primary w-full"
                onClick={() => void loadProducts()}
              >
                <span className="material-symbols-outlined">refresh</span>
                <span className="hidden sm:inline">Reload Products</span>
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
          <span className="hidden xs:inline">{items.length} — ₹{cartSummary.finalAmount.toFixed(0)}</span>
        </button>
      )}

      {/* ─── Status Messages ─── */}
      <AnimatePresence>
        {message ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-green-50 px-4 py-3 text-xs sm:text-sm font-medium text-green-800 border border-green-200 shadow-lg max-w-xs"
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
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-red-50 border border-red-200 p-3 sm:p-4 shadow-lg max-w-xs"
        >
          <p className="text-xs sm:text-sm font-medium text-red-800 mb-2 sm:mb-3">{error}</p>
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
