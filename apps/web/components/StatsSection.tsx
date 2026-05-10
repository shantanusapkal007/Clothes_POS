import React, { useEffect, useState } from "react";
import { getStats } from "../lib/api";

export function StatsSection() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const data = await getStats();
        setStats(data);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) return <div>Loading stats…</div>;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">Product Stats</h2>
      <table className="min-w-full table-auto">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">Name</th>
            <th className="px-2 py-1 text-right">Stock</th>
            <th className="px-2 py-1 text-right">Sold</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s: any) => (
            <tr key={s.productId} className="border-t">
              <td className="px-2 py-1">{s.name}</td>
              <td className="px-2 py-1 text-right">{s.stock}</td>
              <td className="px-2 py-1 text-right">{s.totalSold}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
