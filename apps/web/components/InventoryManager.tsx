"use client";

import { useEffect, useMemo, useState } from "react";
import { type Product } from "../types";
import { createProduct, deleteProduct, getProducts, updateProduct } from "../lib/api";

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

import { InventorySkeleton } from "./Skeleton";

export function InventoryManager() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ Text: string; Type: "success" | "error" } | null>(null);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data);
    } catch {
      showMessage("Failed to load inventory", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, []);

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
      setProducts([newProduct, ...products]);
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
      setProducts(products.filter((p) => p.id !== id));
      showMessage("Product deleted");
    } catch {
      showMessage("Failed to delete product", "error");
    }
  };

  const handleUpdateField = async (id: string, field: keyof Product, value: number | string) => {
    try {
      await updateProduct(id, { [field]: value });
      setProducts(products.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
      showMessage("Updated successfully");
    } catch {
      showMessage("Failed to update", "error");
    }
  };

  const visibleProducts = useMemo(() => {
    if (!search) return products;
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q))
    );
  }, [products, search]);

  const getProductImage = (name: string) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=ffe4e6&color=9f1239&size=128&font-size=0.3`;
  };

  return (
    <div className="relative grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
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

      <section className="rounded-lg border border-outline-variant/30 bg-white/95 p-4 shadow-sm lg:col-span-4 md:p-8">
        <div className="mb-6">
          <h3 className="mb-1 text-2xl font-serif text-primary">Add clothing stock fast</h3>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Price (Rs) <span className="text-error">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant/50">
                  Rs
                </span>
                <input
                  className="field-input pl-11 md:pl-12"
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
                Initial Stock
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
                Default Discount %
              </label>
              <input
                className="field-input"
                placeholder="0"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.discountPercent === 0 ? "" : form.discountPercent}
                onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })}
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
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-bold text-on-primary shadow-lg shadow-primary/20 transition-all hover:bg-primary-container active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            Add to Catalog
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-outline-variant/30 bg-white/95 p-4 shadow-[0_20px_40px_rgba(8,47,46,0.05)] lg:col-span-8 md:p-8">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <div>
            <h3 className="text-2xl font-serif text-on-surface sm:text-3xl">Current Stock</h3>
            <p className="text-on-secondary-container">
              {products.length} items currently in floor rotation.
            </p>
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <div className="flex flex-grow items-center gap-2 rounded-lg border border-outline-variant/60 bg-white px-4 py-3 shadow-sm transition-all focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 md:flex-grow-0 md:py-2">
              <span className="material-symbols-outlined text-sm text-primary md:text-base">
                search
              </span>
              <input
                className="w-full border-none bg-transparent p-0 text-sm font-semibold text-on-surface placeholder:text-on-surface-variant/70 focus:ring-0 md:w-48"
                placeholder="Search catalog..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="material-symbols-outlined shrink-0 rounded-lg border border-outline-variant/60 bg-white p-3 text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-high md:p-2">
              filter_list
            </button>
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
            <div className="space-y-4 md:hidden">
              {visibleProducts.map((p) => (
                <article
                  key={p.id}
                  className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-container-high ring-1 ring-outline-variant/20">
                      <img
                        alt={p.name}
                        src={getProductImage(p.name)}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="truncate font-serif text-lg text-on-surface">{p.name}</h4>
                          <p className="mt-1 truncate text-[11px] uppercase tracking-[0.18em] text-on-secondary-container">
                            {p.category ? `${p.category} • ` : ""}SKU: {p.barcode || p.id.slice(0, 8)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="material-symbols-outlined rounded-lg p-2 text-error/70 transition-colors hover:bg-error-container hover:text-error"
                          title="Delete"
                        >
                          delete
                        </button>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <label className="rounded-lg border border-outline-variant/30 bg-white p-3">
                          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-on-secondary-container">
                            Stock
                          </span>
                          <input
                            className={`field-input-compact text-base ${
                              p.stock <= p.minStock ? "text-error" : "text-on-surface"
                            }`}
                            type="number"
                            value={p.stock}
                            onChange={(e) =>
                              handleUpdateField(p.id, "stock", parseInt(e.target.value, 10) || 0)
                            }
                          />
                          {p.stock <= p.minStock && (
                            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.15em] text-error">
                              Low stock
                            </span>
                          )}
                        </label>

                        <label className="rounded-lg border border-outline-variant/30 bg-white p-3">
                          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-on-secondary-container">
                            Price
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-secondary">Rs</span>
                            <input
                              className="field-input-compact text-right font-serif text-base"
                              type="number"
                              value={p.price}
                              step="0.01"
                              onChange={(e) =>
                                handleUpdateField(p.id, "price", parseFloat(e.target.value) || 0)
                              }
                            />
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[600px] w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-[10px] font-bold uppercase tracking-[0.1em] text-on-surface-variant/60 sm:text-xs sm:tracking-[0.15em]">
                    <th className="pb-4 pl-2 font-bold">Item Detail</th>
                    <th className="pb-4 text-center font-bold">In Stock</th>
                    <th className="pb-4 text-right font-bold">Price</th>
                    <th className="pb-4 pr-2 text-right font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {visibleProducts.map((p) => (
                    <tr key={p.id} className="group transition-colors hover:bg-surface-container-low/50">
                      <td className="py-4 pl-2 md:py-6">
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-container-high ring-1 ring-outline-variant/20 md:h-12 md:w-12">
                            <img
                              alt={p.name}
                              src={getProductImage(p.name)}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate px-1 font-serif text-base leading-tight text-on-surface md:text-lg">
                              {p.name}
                            </div>
                            <div className="mt-1 truncate px-1 text-[10px] uppercase tracking-widest text-on-secondary-container md:text-xs">
                              {p.category ? `${p.category} • ` : ""}SKU: {p.barcode || p.id.slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-center md:py-6">
                        <div className="inline-flex flex-col items-center">
                          <input
                            className={`w-14 rounded-lg border p-2 text-center text-sm font-bold shadow-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 md:w-16 ${
                              p.stock <= p.minStock
                                ? "border-error/30 bg-error-container/60 text-error"
                                : "border-outline-variant/60 bg-white text-on-surface"
                            }`}
                            type="number"
                            value={p.stock}
                            onChange={(e) =>
                              handleUpdateField(p.id, "stock", parseInt(e.target.value, 10) || 0)
                            }
                          />
                          {p.stock <= p.minStock && (
                            <span className="mt-1 text-[9px] font-bold uppercase text-error">
                              Low Stock
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 text-right font-serif text-base text-on-surface md:py-6 md:text-lg">
                        <div className="inline-flex items-center justify-end">
                          <span className="mr-1 text-sm text-secondary">Rs</span>
                          <input
                            className="w-20 rounded-lg border border-outline-variant/60 bg-white p-2 text-right font-serif text-base shadow-sm transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 md:w-24 md:text-lg"
                            type="number"
                            value={p.price}
                            step="0.01"
                            onChange={(e) =>
                              handleUpdateField(p.id, "price", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </td>
                      <td className="py-4 pr-2 text-right md:py-6">
                        <div className="flex justify-end gap-1 transition-opacity sm:opacity-50 group-hover:opacity-100 md:gap-2">
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="material-symbols-outlined rounded-lg p-2 text-error/60 transition-colors hover:bg-error-container hover:text-error"
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
          </>
        )}

        {!loading && visibleProducts.length > 0 && (
          <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-outline-variant/20 pt-6 sm:flex-row">
            <button className="order-2 text-sm font-bold text-primary transition-all hover:underline sm:order-1">
              Download Inventory Report (CSV)
            </button>
            <div className="order-1 flex items-center gap-4 rounded-lg border border-outline-variant/30 bg-white px-4 py-2 shadow-sm sm:order-2">
              <span className="text-xs font-medium text-on-secondary-container">
                {visibleProducts.length} results
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
