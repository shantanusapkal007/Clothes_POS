import { InventoryManager } from "../../components/InventoryManager";

export default function InventoryPage() {
  return (
    <main className="main-content app-shell px-3 pb-4 sm:px-5 md:px-6 md:pb-12">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <header className="mb-5 flex flex-col gap-1 md:mb-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-secondary-container">
            Back Office
          </span>
          <h1 className="text-2xl font-bold text-on-background md:text-3xl">
            Inventory
          </h1>
          <p className="text-sm text-on-secondary-container">
            Manage products, barcodes, and stock levels.
          </p>
        </header>

        <InventoryManager />
      </div>
    </main>
  );
}
