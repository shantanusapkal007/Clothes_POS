"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import useSWR from "swr";
import Barcode from "react-barcode";
import { getProducts } from "../../lib/api";
import { type Product } from "../../types";
import { getBillLayoutConfig, getPrinterConfig, printBarcodeLabel } from "../../lib/printer";

export default function BarcodeGeneratorPage() {
  const [storeName, setStoreName] = useState("Clothing Store");
  const [productSearch, setProductSearch] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Tops");
  const [barcodeVal, setBarcodeVal] = useState("");
  const [price, setPrice] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [showDropdown, setShowDropdown] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Fetch products for dropdown auto-select
  const { data } = useSWR("/api/products", () => getProducts());
  const products = data?.items || [];

  // Load layout store name as initial default
  useEffect(() => {
    try {
      const layout = getBillLayoutConfig();
      if (layout.companyName) {
        setStoreName(layout.companyName);
      }
    } catch {
      // ignore
    }
  }, []);

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleProductSelect = (p: Product) => {
    setName(p.name);
    setCategory(p.category || "General");
    setBarcodeVal(p.barcode || p.id.slice(-8));
    setPrice(p.price);
    setProductSearch("");
    setShowDropdown(false);
    showMsg(`Loaded "${p.name}" details`);
  };

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const generateAutoSKU = () => {
    const randomized = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setBarcodeVal(randomized);
    showMsg("Generated random CODE128 SKU");
  };

  const handlePrint = async () => {
    if (!name.trim()) {
      showMsg("Product Title is required to print", "error");
      return;
    }
    if (!barcodeVal.trim()) {
      showMsg("Barcode SKU is required to print", "error");
      return;
    }
    if (quantity < 1) {
      showMsg("Print Quantity must be at least 1", "error");
      return;
    }

    const config = getPrinterConfig();
    if (config.connected && config.connectionType !== "none") {
      try {
        const layout = getBillLayoutConfig();
        const route = await printBarcodeLabel(
          {
            storeName,
            productName: name,
            category,
            barcode: barcodeVal,
            price,
          },
          quantity,
          config,
          layout
        );

        if (route === "device") {
          showMsg(`Sent ${quantity} labels to ${config.connectionType.toUpperCase()} printer`);
          return;
        }
      } catch (err) {
        console.error("Direct thermal label print failed:", err);
      }
    }

    const barcodeHtml = printRef.current?.innerHTML;
    if (!barcodeHtml) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showMsg("Failed to open print popup. Allow popups for this site.", "error");
      return;
    }

    // Build the bulk print document
    let labelsHtml = "";
    for (let i = 0; i < quantity; i++) {
      labelsHtml += `
        <div class="label-card">
          <div class="store-name">${storeName}</div>
          <div class="barcode-wrapper">
            ${barcodeHtml}
          </div>
          <div class="bottom-row">
            <div class="product-info">
              <div class="product-name">${name}</div>
              <div class="product-type">${category}</div>
            </div>
            <div class="product-price">₹${price.toFixed(2)}</div>
          </div>
        </div>
      `;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Print Labels - ${name}</title>
          <style>
            @media print {
              @page {
                size: 50mm 25mm;
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                background: #fff;
              }
              .label-card {
                width: 50mm;
                height: 25mm;
                box-sizing: border-box;
                padding: 1.5mm 2mm;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                align-items: center;
                overflow: hidden;
                page-break-after: always;
              }
              .label-card:last-child {
                page-break-after: avoid;
              }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #f5f5f5;
              margin: 0;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .label-card {
              background: #fff;
              width: 50mm;
              height: 25mm;
              box-sizing: border-box;
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              align-items: center;
              overflow: hidden;
              margin-bottom: 10px;
              box-shadow: 0 4px 10px rgba(0,0,0,0.05);
            }
            .store-name {
              font-size: 8px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              color: #000;
              margin: 0;
              text-align: center;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              line-height: 1.1;
            }
            .barcode-wrapper {
              display: flex;
              justify-content: center;
              align-items: center;
              width: 100%;
              height: 12mm;
              overflow: hidden;
              margin: 0.2mm 0;
            }
            .barcode-wrapper svg {
              max-width: 100%;
              max-height: 100%;
            }
            .bottom-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              width: 100%;
              border-top: 0.2mm dashed #000;
              padding-top: 0.6mm;
              margin-top: 0.2mm;
            }
            .product-info {
              display: flex;
              flex-direction: column;
              align-items: flex-start;
              max-width: 65%;
              overflow: hidden;
              text-align: left;
            }
            .product-name {
              font-size: 7px;
              font-weight: 700;
              color: #000;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              line-height: 1.1;
            }
            .product-type {
              font-size: 5px;
              font-weight: 500;
              color: #555;
              text-transform: uppercase;
              line-height: 1;
              margin-top: 0.2mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
            }
            .product-price {
              font-size: 10px;
              font-weight: 900;
              color: #000;
              white-space: nowrap;
              line-height: 1;
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
    showMsg(`Sent ${quantity} labels to printer roll`);
  };

  return (
    <div className="main-content app-shell">
      {/* Hidden React Barcode Generator Element */}
      <div className="hidden">
        <div ref={printRef}>
          {barcodeVal && (
            <Barcode
              value={barcodeVal}
              width={1.2}
              height={35}
              fontSize={8}
              margin={0}
            />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-3 py-4 pb-24 md:px-6 md:py-8">
        {/* Toast notifications */}
        {message && (
          <div
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-bold shadow-lg transition-all ${
              message.type === "error"
                ? "bg-rose-50 border border-rose-200 text-rose-700"
                : "bg-emerald-50 border border-emerald-200 text-emerald-700"
            }`}
          >
            <span className="material-symbols-outlined text-base">
              {message.type === "error" ? "error" : "check_circle"}
            </span>
            {message.text}
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-secondary-container">Label Printing</span>
          <h1 className="mt-1 text-2xl font-bold text-on-background md:text-3xl">Barcode Generator</h1>
          <p className="mt-1 text-xs text-on-secondary-container">
            Generate and print bulk thermal labels for clothing items
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left panel: Config Panel */}
          <section className="rounded-2xl border border-outline-variant/30 bg-white/95 p-5 shadow-sm lg:col-span-7 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 border-b pb-2">Label Configuration</h2>

            {/* Catalog search/select */}
            <div className="space-y-2 relative">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Select Product from Catalog
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-outline-variant/60 bg-white px-3 py-2.5 shadow-sm">
                <span className="material-symbols-outlined text-slate-400 text-base">search</span>
                <input
                  className="w-full border-none bg-transparent p-0 text-sm font-semibold focus:outline-none focus:ring-0"
                  placeholder="Search to autofill product details..."
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                />
              </div>

              {/* Selection dropdown */}
              {showDropdown && filteredProducts.length > 0 && (
                <div className="absolute top-[72px] inset-x-0 z-50 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg py-1 divide-y">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProductSelect(p)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <span className="truncate">{p.name}</span>
                      <span className="text-primary shrink-0">₹{p.price.toFixed(0)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Store Name</label>
                <input
                  className="field-input"
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Your Shop Name"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Product Title</label>
                <input
                  className="field-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Linen Blouse Ivory"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Category / Type</label>
                <input
                  className="field-input"
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Tops, Dresses, Accessories"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Price (₹)</label>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price || ""}
                  onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center justify-between">
                  <span>Barcode (SKU SKU)</span>
                  <button
                    type="button"
                    onClick={generateAutoSKU}
                    className="text-[10px] text-primary hover:underline lowercase font-bold"
                  >
                    Auto-Generate
                  </button>
                </label>
                <input
                  className="field-input"
                  type="text"
                  value={barcodeVal}
                  onChange={(e) => setBarcodeVal(e.target.value)}
                  placeholder="Scan or enter SKU number"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Print Quantity</label>
                <input
                  className="field-input text-center font-bold"
                  type="number"
                  min="1"
                  max="100"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                />
              </div>
            </div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              type="button"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-violet-600 py-4 font-black text-white shadow-[0_8px_25px_rgba(99,102,241,0.25)] transition-all hover:from-primary-container hover:to-violet-700 hover:shadow-[0_12px_30px_rgba(99,102,241,0.35)] active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-lg">print</span>
              PRINT {quantity} LABEL{quantity > 1 ? "S" : ""}
            </button>
          </section>
 
          {/* Right panel: Mockup Preview */}
          <section className="lg:col-span-5 flex flex-col items-center justify-center space-y-4 lg:sticky lg:top-24">
            <span className="text-xs font-bold uppercase tracking-wider text-on-secondary-container/60 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">visibility</span>
              50mm × 25mm Live Preview Mockup
            </span>
 
            {/* Simulated sticker label wrapper with a backing roll effect */}
            <div className="relative p-6 bg-slate-900/5 rounded-3xl border border-slate-200/40 shadow-inner flex flex-col items-center select-none w-full max-w-[340px]">
              {/* Backing paper circular punch holes */}
              <div className="absolute inset-y-0 left-2.5 w-3 flex flex-col justify-between py-5 items-center select-none">
                <div className="w-2.5 h-2.5 bg-slate-200/80 rounded-full border border-slate-300/30" />
                <div className="w-2.5 h-2.5 bg-slate-200/80 rounded-full border border-slate-300/30" />
                <div className="w-2.5 h-2.5 bg-slate-200/80 rounded-full border border-slate-300/30" />
              </div>
              <div className="absolute inset-y-0 right-2.5 w-3 flex flex-col justify-between py-5 items-center select-none">
                <div className="w-2.5 h-2.5 bg-slate-200/80 rounded-full border border-slate-300/30" />
                <div className="w-2.5 h-2.5 bg-slate-200/80 rounded-full border border-slate-300/30" />
                <div className="w-2.5 h-2.5 bg-slate-200/80 rounded-full border border-slate-300/30" />
              </div>
 
              {/* The actual simulated label card */}
              <div className="relative w-[260px] h-[130px] bg-white rounded-xl border border-slate-100 shadow-[0_12px_30px_rgba(0,0,0,0.065)] p-3 flex flex-col justify-between items-center overflow-hidden transition-all duration-300 hover:shadow-[0_15px_35px_rgba(0,0,0,0.1)]">
                {/* Store logo/name */}
                <div className="w-full text-center">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-800 truncate w-full flex items-center justify-center gap-1">
                    <span className="material-symbols-outlined text-[10px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>apparel</span>
                    {storeName || "CLOTHING STORE"}
                  </div>
                </div>
 
                {/* Barcode representation */}
                <div className="flex flex-col items-center justify-center w-full h-[52px] overflow-hidden my-0.5 bg-slate-50/50 p-1 rounded-lg border border-dashed border-slate-100">
                  {barcodeVal ? (
                    <Barcode
                      value={barcodeVal}
                      width={1.2}
                      height={24}
                      fontSize={8}
                      margin={0}
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-0.5 text-[8px] text-slate-400 font-bold italic">
                      <span className="material-symbols-outlined text-sm animate-pulse">barcode_reader</span>
                      Enter SKU SKU
                    </div>
                  )}
                </div>
 
                {/* Label footer row */}
                <div className="flex justify-between items-end w-full border-t border-dashed border-slate-300 pt-1.5 mt-0.5">
                  <div className="flex flex-col items-start max-w-[65%] overflow-hidden text-left">
                    <span className="text-[9px] font-black text-slate-800 truncate w-full leading-tight">
                      {name || "Linen Shirt White"}
                    </span>
                    <span className="text-[7px] font-bold text-slate-400 uppercase tracking-wide leading-none mt-0.5">
                      {category || "Tops"}
                    </span>
                  </div>
                  <div className="text-[12px] font-black text-slate-900 leading-none shrink-0 tracking-wide font-headline">
                    ₹{price ? price.toFixed(2) : "0.00"}
                  </div>
                </div>
              </div>
            </div>
 
            <p className="text-[10px] text-center text-slate-400 font-semibold max-w-[260px] leading-relaxed">
              Tip: The print engine loops continuous thermal outputs perfectly mapped for 50mm x 25mm label rolls.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
