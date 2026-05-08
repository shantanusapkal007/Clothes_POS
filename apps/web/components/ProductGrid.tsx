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
      className="grid grid-cols-4 gap-1 xs:grid-cols-4 xs:gap-1.5 sm:grid-cols-4 sm:gap-2 md:grid-cols-5 md:gap-3 lg:grid-cols-6 lg:gap-3"
    >
      {products.map((product) => {
        const lowStock = product.stock <= (product.minStock ?? 2);
        const color = getColor(product.name);
        return (
          <motion.button
            variants={itemVariants}
            key={product.id}
            type="button"
            onClick={() => onAdd(product)}
            className="group relative flex flex-col items-center rounded-lg sm:rounded-xl border border-outline-variant/25 bg-white p-1.5 sm:p-2 md:p-3 text-center shadow-sm transition-all active:scale-[0.95] active:shadow-md md:hover:shadow-md md:hover:-translate-y-0.5 touch-action-manipulation"
            style={{ minHeight: '100px' }}
          >
            {/* Low stock indicator */}
            {lowStock && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 sm:h-3.5 sm:w-3.5 items-center justify-center rounded-full bg-red-500 text-[6px] sm:text-[7px] font-bold text-white ring-2 ring-white">
                !
              </span>
            )}

            {/* Avatar circle */}
            <div className={`flex h-9 w-9 sm:h-11 sm:w-11 md:h-14 md:w-14 items-center justify-center rounded-full ${color.bg} mb-1 sm:mb-1.5 md:mb-2`}>
              <span className={`text-xs sm:text-sm md:text-base font-bold ${color.text}`}>
                {getInitials(product.name)}
              </span>
            </div>

            {/* Product name */}
            <p className="line-clamp-2 w-full text-[11px] sm:text-xs font-bold leading-tight text-on-surface">
              {product.name}
            </p>

            {/* Category */}
            {product.category && (
              <p className="mt-0.5 truncate w-full text-[9px] font-bold uppercase tracking-wider text-on-secondary-container/70 sm:text-[10px]">
                {product.category}
              </p>
            )}

            {/* Price */}
            <p className="mt-auto pt-1 text-sm font-extrabold tabular-nums text-primary">
              ₹{product.price.toFixed(0)}
            </p>

            {/* Stock count */}
            <p className={`text-[8px] font-bold tabular-nums uppercase ${lowStock ? "text-red-600" : "text-on-secondary-container/50"} sm:text-[9px]`}>
              {product.stock} in stock
            </p>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export const ProductGrid = memo(ProductGridComponent);
