"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import useSWR from "swr";
import { type Product } from "../types";
import { createProduct, deleteProduct, getProducts, updateProduct } from "../lib/api";
import { InventorySkeleton } from "./Skeleton";
import Barcode from "react-barcode";
import { getBillLayoutConfig } from "../lib/printer";

type FormState = {
  name: string;
  category: string;
  barcode: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  discountPercent: number;
  taxPercent: number;
};

const DEFAULT_FORM: FormState = {
  name: "",
  category: "Tops",
  barcode: "",
  price: 0,
  costPrice: 0,
  stock: 0,
  minStock: 2,
  discountPercent: 0,
  taxPercent: 0
};

export function InventoryManager() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [search, setSearch] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [message, setMessage] = useState<{ Text: string; Type: "success" | "error" } | null>(null);
  
  const [barcodeToPrint, setBarcodeToPrint] = useState<Product | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const { data, error, isLoading, mutate } = useSWR(
    "/api/products",
    () => getProducts(),
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const products = data?.items || [];
  const loading = isLoading;

  const showMessage = (msg: string, type: "success" | "error" = "success") => {
    setMessage({ Text: msg, Type: type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || form.price <= 0) {
      showMessage("Please provide valid name and price", "error");
      return;
    }

    try {
      const newProduct = await createProduct(form);
      void mutate(
        {
          items: [newProduct, ...products],
          totalCount: (data?.totalCount || 0) + 1,
        },
        { revalidate: true }
      );
      setForm(DEFAULT_FORM);
      showMessage("Product added to stock");
    } catch {
      showMessage("Failed to add product", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      await deleteProduct(id);
      void mutate(
        {
          items: products.filter((p) => p.id !== id),
          totalCount: (data?.totalCount || 0) - 1,
        },
        { revalidate: true }
      );
      showMessage("Product deleted");
    } catch {
      showMessage("Failed to delete product", "error");
    }
  };

  const handleUpdateField = async (id: string, field: keyof Product, value: number | string) => {
    try {
      await updateProduct(id, { [field]: value });
      void mutate(
        {
          items: products.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
          totalCount: data?.totalCount || 0,
        },
        { revalidate: true }
      );
      showMessage("Updated successfully");
    } catch {
      showMessage("Failed to update", "error");
    }
  };

  const visibleProducts = useMemo(() => {
    let filtered = products;
    if (filterLowStock) {
      filtered = filtered.filter(p => p.stock <= p.minStock);
    }
    if (!search) return filtered;
    const q = search.toLowerCase();
    return filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, search, filterLowStock]);

  const handlePrintBarcode = (p: Product) => {
    const layout = getBillLayoutConfig();
    const storeName = layout.companyName || "Clothing Store";
    setBarcodeToPrint(p);
    setTimeout(() => {
      const content = printRef.current;
      if (!content) return;
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Barcode - ${p.name}</title>
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
                  width: 50mm;
                  height: 25mm;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                }
              }
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background: #f0f0f0;
                margin: 0;
                padding: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                height: 100vh;
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
            <div class="label-card">
              <div class="store-name">${storeName}</div>
              <div class="barcode-wrapper">
                ${content.innerHTML}
              </div>
              <div class="bottom-row">
                <div class="product-info">
                  <div class="product-name">${p.name}</div>
                  <div class="product-type">${p.category || "General"}</div>
                </div>
                <div class="product-price">₹${p.price.toFixed(2)}</div>
              </div>
            </div>
            <script>window.onload = () => { window.print(); window.close(); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
      setBarcodeToPrint(null);
    }, 100);
  };

  const getProductImage = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=ffe4e6&color=9f1239&size=128&font-size=0.3`;
  };

  const getStockBadge = (stock: number, minStock: number) => {
    if (stock === 0) return { label: 'Sold Out', cls: 'bg-rose-100 text-rose-700 border-rose-200' };
    if (stock <= minStock) return { label: 'Low Stock', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'In Stock', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  return (
    <div className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* Hidden print helper */}
      <div className="hidden">
        <div ref={printRef}>
          {barcodeToPrint && (
            <Barcode 
              value={barcodeToPrint.barcode || barcodeToPrint.id.slice(-8)} 
              width={1.2} 
              height={35} 
              fontSize={8}
              margin={0}
            />
          )}
        </div>
      </div>

      <div className="pointer-events-none fixed left-1/2 top-4 z-50 flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 flex-col gap-2 sm:w-auto">
        {message && (
          <div
            className={`pointer-events-auto flex items-center gap-2 rounded-lg px-4 py-3 text-sm shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:px-6 ${
              message.Type === "error"
                ? "bg-error-container text-error"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            <span className="material-symbols-outlined text-sm">
              {message.Type === "error" ? "error" : "check_circle"}
            </span>
            {message.Text}
          </div>
        )}
      </div>

      <section className="rounded-2xl border border-outline-variant/30 bg-white/95 p-4 shadow-sm lg:col-span-4 md:p-8">
        <div className="mb-6">
          <h3 className="mb-1 text-2xl font-serif text-primary">Add clothing stock</h3>
          <p className="text-sm text-on-secondary-container">
            Quick register for new seasonal items.
          </p>
        </div>

        <form className="space-y-6" onSubmit={handleCreateProduct}>
          <div className="space-y-2">
            <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
              Product Title <span className="text-error">*</span>
            </label>
            <input
              className="field-input"
              placeholder="e.g. Linen Blouse Ivory"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Category
              </label>
              <select
                className="field-input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option>Tops</option>
                <option>Dresses</option>
                <option>Bottoms</option>
                <option>Accessories</option>
                <option>Outerwear</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Barcode (SKU)
              </label>
              <input
                className="field-input"
                placeholder="Auto-generate"
                type="text"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Purchase Rate (₹)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant/50">
                  ₹
                </span>
                <input
                  className="field-input pl-11"
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.costPrice || ""}
                  onChange={(e) => setForm({ ...form, costPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Selling Rate (₹) <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant/50">
                  ₹
                </span>
                <input
                  className="field-input pl-11"
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Stock
              </label>
              <input
                className="field-input"
                placeholder="0"
                type="number"
                min="0"
                value={form.stock || ""}
                onChange={(e) => setForm({ ...form, stock: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Low Stock Alert at
              </label>
              <input
                className="field-input"
                placeholder="2"
                type="number"
                min="0"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Tax %
              </label>
              <input
                className="field-input"
                placeholder="0"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.taxPercent}
                onChange={(e) => setForm({ ...form, taxPercent: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          <button
            type="submit"
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-4 font-bold text-white shadow-lg transition-all hover:bg-slate-800 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add to Catalog
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-outline-variant/30 bg-white/95 p-4 shadow-[0_20px_40px_rgba(8,47,46,0.05)] lg:col-span-8 md:p-8">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h3 className="text-2xl font-serif text-on-surface sm:text-3xl">Current Stock</h3>
            <p className="text-on-secondary-container">
              {visibleProducts.length} items currently in inventory.
            </p>
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <button
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                filterLowStock ? "border-rose-200 bg-rose-50 text-rose-700" : "border-outline-variant/60 bg-white text-slate-500"
              }`}
            >
              <span className="material-symbols-outlined text-sm">warning</span>
              {filterLowStock ? "Showing Low Stock" : "Low Stock Alerts"}
            </button>
            <div className="flex flex-grow items-center gap-2 rounded-xl border border-outline-variant/60 bg-white px-4 py-3 shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 md:flex-grow-0 md:py-2">
              <span className="material-symbols-outlined text-sm text-primary md:text-base">search</span>
              <input
                className="w-full border-none bg-transparent p-0 text-sm font-semibold text-on-surface placeholder:text-on-surface-variant/70 focus:ring-0 md:w-48"
                placeholder="Search..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <InventorySkeleton />
        ) : visibleProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 p-8 text-center text-secondary">
            <span className="material-symbols-outlined mb-4 text-4xl opacity-50">inventory_2</span>
            <h3 className="mb-1 font-headline text-lg">No products found</h3>
            <p className="text-sm">Store looks empty. Add some new stock!</p>
          </div>
        ) : (
          <>
            {/* ===== Desktop Table (hidden on mobile) ===== */}
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[600px] w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/60 sm:text-xs">
                    <th className="pb-4 pl-2">Item Detail</th>
                    <th className="pb-4 text-center">Stock</th>
                    <th className="pb-4 text-center">Status</th>
                    <th className="pb-4 text-right">Purchase</th>
                    <th className="pb-4 text-right">Selling</th>
                    <th className="pb-4 text-right">Margin</th>
                    <th className="pb-4 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {visibleProducts.map((p) => {
                    const badge = getStockBadge(p.stock, p.minStock);
                    const margin = p.costPrice > 0 ? (((p.price - p.costPrice) / p.costPrice) * 100).toFixed(0) : "0";
                    return (
                      <tr key={p.id} className="group transition-colors hover:bg-slate-50/50">
                        <td className="py-4 pl-2 md:py-6">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                              <img alt={p.name} src={getProductImage(p.name)} className="h-full w-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-serif text-base font-bold text-slate-900">{p.name}</div>
                              <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {p.category} • SKU: {p.barcode || p.id.slice(-8)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-center md:py-6">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => handleUpdateField(p.id, 'stock', Math.max(0, p.stock - 1))}
                              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-lg font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                              title="Decrease stock"
                            >
                              −
                            </button>
                            <input
                              className={`w-16 rounded-xl border p-2 text-center text-sm font-black shadow-sm ${
                                p.stock <= p.minStock ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-100 bg-white text-slate-900"
                              }`}
                              type="number"
                              value={p.stock}
                              onChange={(e) => handleUpdateField(p.id, "stock", parseInt(e.target.value, 10) || 0)}
                            />
                            <button
                              onClick={() => handleUpdateField(p.id, 'stock', p.stock + 1)}
                              className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-lg font-bold text-slate-600 transition hover:bg-slate-200 active:scale-95"
                              title="Increase stock"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-4 text-center md:py-6">
                          <span className={`inline-block rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wide ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-4 text-right md:py-6">
                          <input
                            className="w-24 rounded-xl border border-slate-100 bg-white p-2 text-right font-serif text-sm font-bold focus:border-slate-900 focus:ring-0"
                            type="number"
                            value={p.costPrice}
                            step="0.01"
                            onChange={(e) => handleUpdateField(p.id, "costPrice", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-4 text-right md:py-6">
                          <input
                            className="w-24 rounded-xl border border-slate-100 bg-white p-2 text-right font-serif text-sm font-bold focus:border-slate-900 focus:ring-0"
                            type="number"
                            value={p.price}
                            step="0.01"
                            onChange={(e) => handleUpdateField(p.id, "price", parseFloat(e.target.value) || 0)}
                          />
                        </td>
                        <td className="py-4 text-right md:py-6">
                          <span className={`text-xs font-black ${p.price > p.costPrice ? "text-emerald-600" : "text-rose-500"}`}>
                            {margin}%
                          </span>
                        </td>
                        <td className="py-4 pr-2 text-right md:py-6">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handlePrintBarcode(p)}
                              className="material-symbols-outlined rounded-xl bg-slate-50 p-2 text-slate-400 transition hover:bg-slate-900 hover:text-white"
                              title="Print Barcode"
                            >
                              barcode_scanner
                            </button>
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              className="material-symbols-outlined rounded-xl bg-slate-50 p-2 text-rose-300 transition hover:bg-rose-600 hover:text-white"
                              title="Delete"
                            >
                              delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ===== Mobile Card List (visible only on mobile) ===== */}
            <div className="block md:hidden">
              <div className="grid grid-cols-1 gap-3">
                {visibleProducts.map((p) => {
                  const badge = getStockBadge(p.stock, p.minStock);
                  const margin = p.costPrice > 0 ? (((p.price - p.costPrice) / p.costPrice) * 100).toFixed(0) : "0";
                  return (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-outline-variant/20 bg-white p-4 shadow-sm"
                    >
                      {/* Top row: Avatar + Info + Badge */}
                      <div className="flex items-start gap-3">
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                          <img alt={p.name} src={getProductImage(p.name)} className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-serif text-base font-bold text-slate-900">{p.name}</div>
                          <div className="mt-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {p.category} • SKU: {p.barcode || p.id.slice(-8)}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Price row */}
                      <div className="mt-3 flex items-center gap-4 rounded-xl bg-slate-50 px-3 py-2.5">
                        <div className="flex-1">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cost</div>
                          <div className="font-serif text-sm font-bold text-slate-700">₹{p.costPrice}</div>
                        </div>
                        <div className="flex-1">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Selling</div>
                          <div className="font-serif text-sm font-bold text-slate-900">₹{p.price}</div>
                        </div>
                        <div className="flex-1 text-right">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Margin</div>
                          <div className={`font-serif text-sm font-black ${p.price > p.costPrice ? "text-emerald-600" : "text-rose-500"}`}>
                            {margin}%
                          </div>
                        </div>
                      </div>

                      {/* Stock stepper + actions row */}
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateField(p.id, 'stock', Math.max(0, p.stock - 1))}
                            className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-600 transition active:scale-90"
                            title="Decrease stock"
                          >
                            −
                          </button>
                          <input
                            className={`w-16 rounded-xl border p-2 text-center text-sm font-black shadow-sm ${
                              p.stock <= p.minStock ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-100 bg-white text-slate-900"
                            }`}
                            type="number"
                            value={p.stock}
                            onChange={(e) => handleUpdateField(p.id, "stock", parseInt(e.target.value, 10) || 0)}
                          />
                          <button
                            onClick={() => handleUpdateField(p.id, 'stock', p.stock + 1)}
                            className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-xl font-bold text-slate-600 transition active:scale-90"
                            title="Increase stock"
                          >
                            +
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handlePrintBarcode(p)}
                            className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition active:bg-slate-200"
                            title="Print Barcode"
                          >
                            barcode_scanner
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="material-symbols-outlined flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-rose-400 transition active:bg-rose-100"
                            title="Delete"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
