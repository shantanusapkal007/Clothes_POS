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
  hidden: { opacity: 0, y: 12, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 350, damping: 25 } }
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
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="p-6 text-center text-secondary border border-dashed border-white/80 rounded-lg bg-white/70 backdrop-blur-md md:p-8"
      >
        <span className="material-symbols-outlined text-4xl mb-3 opacity-40 md:text-5xl md:mb-4">search_off</span>
        <h3 className="font-headline text-lg mb-1 text-on-surface md:text-xl">No products found</h3>
        <p className="text-xs md:text-sm">Try adjusting your search query or add new stock.</p>
      </motion.div>
    );
  }

  const getProductImage = (name: string, category: string | null) => {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=ffe4e6&color=9f1239&size=256&font-size=0.3`;
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-3 gap-2 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:gap-6"
    >
      {products.map((product) => (
        <motion.div
          variants={itemVariants}
          key={product.id}
          className="group flex cursor-pointer flex-col rounded-lg p-1.5 transition-colors [content-visibility:auto] active:bg-primary/5 md:p-2 md:hover:bg-white/70"
          onClick={() => onAdd(product)}
        >
          <div className="relative mb-2 aspect-square overflow-hidden rounded-lg bg-surface-container-low ring-1 ring-white/80 shadow-sm transition-transform duration-300 group-active:scale-95 md:aspect-[3/4] md:mb-3 md:shadow-[0_8px_20px_rgb(0,0,0,0.03)] md:group-hover:-translate-y-1 md:group-hover:shadow-[0_15px_35px_rgb(0,0,0,0.06)]">
            <img
              alt={product.name}
              className="w-full h-full object-cover mix-blend-multiply opacity-90 md:group-hover:scale-105 transition-transform duration-700 ease-out"
              src={getProductImage(product.name, product.category)}
            />
            {/* Desktop hover overlay */}
            <div className="absolute inset-0 hidden md:flex bg-primary/0 group-hover:bg-primary/5 transition-colors items-center justify-center">
              <div className="bg-white/90 backdrop-blur-xl w-10 h-10 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-[0_8px_20px_rgba(15,118,110,0.15)] transform translate-y-4 group-hover:translate-y-0 duration-400 ease-[cubic-bezier(0.23,1,0.32,1)]">
                <span className="material-symbols-outlined text-primary text-xl">add</span>
              </div>
            </div>
            {/* Mobile tap indicator */}
            <div className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-md bg-primary/90 text-on-primary shadow-sm md:hidden">
              <span className="material-symbols-outlined text-[14px]">add</span>
            </div>
          </div>
          <div className="px-0.5 md:px-1.5">
            <h4 className="mb-0.5 line-clamp-2 text-xs font-semibold leading-tight text-on-surface md:mb-1 md:text-sm lg:text-base">
              {product.name}
            </h4>
            <div className="flex justify-between items-center">
              <p className="text-primary font-headline font-bold text-xs md:text-sm lg:text-base tracking-tight">
                Rs {product.price.toFixed(0)}
              </p>
              <p className="inline-flex items-center rounded-md bg-white/70 px-1.5 py-0.5 text-[9px] font-bold tracking-widest text-on-secondary-container md:rounded-lg md:px-2 md:text-[10px]">
                {product.stock}
              </p>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

export const ProductGrid = memo(ProductGridComponent);
