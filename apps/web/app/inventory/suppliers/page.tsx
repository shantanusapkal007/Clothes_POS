import { SupplierManager } from "../../../components/SupplierManager";

export default function SuppliersPage() {
  return (
    <main className="main-content app-shell bg-slate-50/50 px-4 py-6 pb-24 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <SupplierManager />
      </div>
    </main>
  );
}
