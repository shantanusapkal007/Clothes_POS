import { memo } from "react";
import { motion } from "framer-motion";
import type { Product } from "../types";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.03, delayChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 400, damping: 28 } }
};

function ProductGridComponent({
  products,
  onAdd
}: {
  products: Product[];
  onAdd: (p: Product) => void;
}) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <span className="material-symbols-outlined mb-3 text-4xl text-on-surface-variant/40">search_off</span>
        <h3 className="text-base font-bold text-on-surface">No products found</h3>
        <p className="mt-1 text-xs text-on-secondary-container">Try adjusting your search or add new stock.</p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
    >
      {products.map((product) => {
        const lowStock = product.stock <= (product.minStock ?? 2);
        return (
          <motion.button
            variants={itemVariants}
            key={product.id}
            type="button"
            onClick={() => onAdd(product)}
            className="group flex flex-col rounded-xl border border-outline-variant/30 bg-white p-2.5 text-left shadow-sm transition-all active:scale-[0.97] active:bg-primary/5 md:p-3 md:hover:shadow-md md:hover:-translate-y-0.5"
          >
            {/* Product Info */}
            <div className="mb-1">
              <h4 className="line-clamp-2 text-[13px] font-semibold leading-snug text-on-surface md:text-sm">
                {product.name}
              </h4>
              {product.category && (
                <p className="mt-0.5 truncate text-[10px] text-on-secondary-container/70">
                  {product.category}
                </p>
              )}
            </div>

            {/* Price + Stock Row */}
            <div className="mt-auto flex items-end justify-between pt-1.5">
              <span className="text-sm font-bold tabular-nums text-primary md:text-base">
                ₹{product.price.toFixed(0)}
              </span>
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  lowStock
                    ? "bg-red-50 text-red-700"
                    : "bg-surface-container-high/60 text-on-secondary-container"
                }`}
              >
                {product.stock}
              </span>
            </div>

            {/* Quick add indicator */}
            <div className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-primary/8 py-1.5 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors group-active:bg-primary group-active:text-white md:group-hover:bg-primary md:group-hover:text-white">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
              Add
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export const ProductGrid = memo(ProductGridComponent);
