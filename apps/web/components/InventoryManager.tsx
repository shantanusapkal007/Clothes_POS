"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import useSWR from "swr";
import { type Product } from "../types";
import { createProduct, deleteProduct, getProducts, updateProduct } from "../lib/api";
import { InventorySkeleton } from "./Skeleton";
import Barcode from "react-barcode";

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
              body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; }
              .label { text-align: center; border: 1px solid #eee; padding: 20px; border-radius: 8px; }
              .name { font-weight: bold; margin-bottom: 5px; font-size: 14px; }
              .price { font-size: 18px; font-weight: 900; margin-top: 5px; }
            </style>
          </head>
          <body>
            <div class="label">
              <div class="name">${p.name}</div>
              ${content.innerHTML}
              <div class="price">₹${p.price}</div>
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

  return (
    <div className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
      {/* Hidden print helper */}
      <div className="hidden">
        <div ref={printRef}>
          {barcodeToPrint && (
            <Barcode 
              value={barcodeToPrint.barcode || barcodeToPrint.id.slice(-8)} 
              width={1.5} 
              height={50} 
              fontSize={12}
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
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[600px] w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-outline-variant/20 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/60 sm:text-xs">
                  <th className="pb-4 pl-2">Item Detail</th>
                  <th className="pb-4 text-center">Stock</th>
                  <th className="pb-4 text-right">Purchase</th>
                  <th className="pb-4 text-right">Selling</th>
                  <th className="pb-4 text-right">Margin</th>
                  <th className="pb-4 pr-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {visibleProducts.map((p) => (
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
                      <div className="inline-flex flex-col items-center">
                        <input
                          className={`w-16 rounded-xl border p-2 text-center text-sm font-black shadow-sm ${
                            p.stock <= p.minStock ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-100 bg-white text-slate-900"
                          }`}
                          type="number"
                          value={p.stock}
                          onChange={(e) => handleUpdateField(p.id, "stock", parseInt(e.target.value, 10) || 0)}
                        />
                        {p.stock <= p.minStock && <span className="mt-1 text-[8px] font-black uppercase text-rose-500">Low Stock</span>}
                      </div>
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
                        {p.costPrice > 0 ? (((p.price - p.costPrice) / p.costPrice) * 100).toFixed(0) : "0"}%
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
