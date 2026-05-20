"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { Product } from "../types";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.1 } }
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/* Deterministic pastel color from name */
function getColor(name: string) {
  const colors = [
    { bg: "bg-rose-100", text: "text-rose-700" },
    { bg: "bg-sky-100", text: "text-sky-700" },
    { bg: "bg-amber-100", text: "text-amber-700" },
    { bg: "bg-emerald-100", text: "text-emerald-700" },
    { bg: "bg-violet-100", text: "text-violet-700" },
    { bg: "bg-teal-100", text: "text-teal-700" },
    { bg: "bg-pink-100", text: "text-pink-700" },
    { bg: "bg-indigo-100", text: "text-indigo-700" },
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function ProductGridComponent({
  products,
  onAdd
}: {
  products: Product[];
  onAdd: (p: Product) => void;
}) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 md:py-16 text-center">
        <span className="material-symbols-outlined mb-2 sm:mb-3 text-4xl sm:text-5xl text-on-surface-variant/30">search_off</span>
        <h3 className="text-sm sm:text-base md:text-lg font-bold text-on-surface">No products found</h3>
        <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs md:text-sm text-on-secondary-container">Try adjusting your search or add new stock.</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-3 gap-2 xs:grid-cols-3 xs:gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 lg:gap-4 xl:grid-cols-6"
    >
      {products.map((product) => {
        const isOutOfStock = product.stock <= 0;
        const isLowStock = !isOutOfStock && product.stock <= (product.minStock ?? 2);
        const color = getColor(product.name);
        return (
          <motion.button
            variants={itemVariants}
            key={product.id}
            type="button"
            onClick={() => onAdd(product)}
            disabled={isOutOfStock}
            className={`group relative flex flex-col items-center rounded-xl sm:rounded-2xl border bg-white p-2.5 sm:p-3 md:p-4 text-center shadow-sm transition-all duration-200 active:scale-[0.95] active:shadow-md md:hover:shadow-lg md:hover:-translate-y-1 touch-action-manipulation select-none ${
              isOutOfStock
                ? "border-outline-variant/10 opacity-40 cursor-not-allowed bg-slate-50"
                : isLowStock
                ? "border-amber-300 ring-2 ring-amber-100/50 hover:border-amber-400"
                : "border-outline-variant/30 hover:border-primary/50"
            }`}
            style={{ minHeight: '120px' }}
          >
            {/* Low / Out of Stock Banner */}
            {isOutOfStock && (
              <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow">
                Sold Out
              </span>
            )}

            {/* Avatar circle */}
            <div className={`flex h-11 w-11 sm:h-12 sm:w-12 md:h-16 md:w-16 items-center justify-center rounded-full ${color.bg} mb-1.5 sm:mb-2 shadow-inner group-hover:scale-105 transition-transform duration-200`}>
              <span className={`text-xs sm:text-sm md:text-lg font-extrabold tracking-wide ${color.text}`}>
                {getInitials(product.name)}
              </span>
            </div>

            {/* Product name */}
            <p className="line-clamp-2 w-full text-[11px] sm:text-xs font-extrabold leading-snug text-on-surface group-hover:text-primary transition-colors">
              {product.name}
            </p>

            {/* Category */}
            {product.category && (
              <span className="mt-1 rounded-full bg-secondary/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-secondary/80 sm:text-[9px]">
                {product.category}
              </span>
            )}

            {/* Price */}
            <p className="mt-auto pt-2 text-sm sm:text-base font-black tabular-nums text-primary">
              ₹{product.price.toFixed(0)}
            </p>

            {/* Stock status badge */}
            <div className="mt-1 w-full flex items-center justify-center">
              {isOutOfStock ? (
                <span className="rounded bg-red-50 px-1 py-0.5 text-[8px] font-extrabold uppercase text-red-600">
                  Out of Stock (0)
                </span>
              ) : isLowStock ? (
                <span className="rounded bg-amber-50 px-1 py-0.5 text-[8px] font-extrabold uppercase text-amber-700 animate-pulse">
                  Low Stock ({product.stock})
                </span>
              ) : (
                <span className="rounded bg-green-50 px-1 py-0.5 text-[8px] font-bold uppercase text-green-700">
                  {product.stock} in stock
                </span>
              )}
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export const ProductGrid = memo(ProductGridComponent);
