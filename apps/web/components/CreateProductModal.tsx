"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FormEvent, useEffect, useState } from "react";
import type { BarcodeData } from "../lib/barcode-parser";
import type { Product } from "../types";

type CreateProductModalProps = {
  barcode: string;
  seed?: BarcodeData | null;
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    name: string;
    category?: string;
    barcode?: string;
    price: number;
    costPrice: number;
    stock: number;
    minStock: number;
    discountPercent: number;
    taxPercent: number;
  }) => Promise<Product>;
};

export function CreateProductModal({
  barcode,
  seed,
  open,
  onClose,
  onCreate
}: CreateProductModalProps) {
  const [form, setForm] = useState({
    name: "",
    category: "",
    barcode,
    price: 0,
    costPrice: 0,
    stock: 1,
    minStock: 0,
    discountPercent: 0,
    taxPercent: 0
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setError(null);
    setForm({
      name: "",
      category: "",
      barcode: seed?.barcode ?? barcode,
      price: seed?.price ?? 0,
      costPrice: 0,
      stock: 1,
      minStock: 0,
      discountPercent: seed?.discount ?? 0,
      taxPercent: 0
    });
  }, [open, barcode, seed]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      await onCreate(form);
      onClose();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Unable to create");
    } finally {
      setPending(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop"
        >
          <motion.div 
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="modal-card"
          >
            <div className="panel-heading">
              <div>
                <p className="eyebrow">New product</p>
                <h2>Create scanned item</h2>
              </div>
              <button
                className="button button-ghost self-start sm:self-auto"
                type="button"
                onClick={onClose}
              >
                Close
              </button>
            </div>

            <form className="inventory-form" onSubmit={handleSubmit}>
              <section className="space-y-3">
                <input
                  className="text-input"
                  placeholder="Product name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />

                <div className="inventory-grid">
                  <input
                    className="text-input"
                    placeholder="Category (optional)"
                    value={form.category}
                    onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  />
                  <input
                    className="text-input"
                    placeholder="Barcode (optional)"
                    value={form.barcode}
                    onChange={(event) => setForm((prev) => ({ ...prev, barcode: event.target.value }))}
                  />
                </div>
              </section>

              <section className="rounded-lg border border-outline-variant/30 bg-white p-4 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                <p className="eyebrow">Pricing & Inventory</p>
                <div className="inventory-grid">
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant/50">
                      Rs
                    </span>
                    <input
                      className="text-input w-full pl-11 font-headline font-bold text-primary"
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="Price"
                      value={form.price || ""}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, price: Number(event.target.value) }))
                      }
                      required
                    />
                  </div>
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    placeholder="Initial stock"
                    value={form.stock}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, stock: Number(event.target.value) }))
                    }
                  />
                </div>
                <div className="inventory-grid mt-3">
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="Default Discount %"
                    value={form.discountPercent === 0 ? "" : form.discountPercent}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, discountPercent: Number(event.target.value) }))
                    }
                  />
                  <input
                    className="text-input"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="Tax %"
                    value={form.taxPercent}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, taxPercent: Number(event.target.value) }))
                    }
                  />
                </div>
              </section>

              {error ? <p className="error-text">{error}</p> : null}

              <button className="button button-primary w-full shadow-xl" disabled={pending} type="submit">
                {pending ? "Creating..." : "Create product"}
              </button>

              <p className="text-[10px] uppercase font-bold tracking-[0.1em] text-on-secondary-container mt-2">
                Tip: To auto-fill price/discount/qty from stickers, use QR/CODE128 data like{" "}
                <code className="bg-surface-container-high/60 px-1 py-0.5 rounded ml-1">BARCODE|299.99|10|2</code>.
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
