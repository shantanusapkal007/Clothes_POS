import React from "react";
import { StatsSection } from "../../components/StatsSection";

export default function StatsPage() {
  return (
    <div className="main-content app-shell">
      <div className="max-w-4xl mx-auto py-8 px-3 md:px-6 pb-24">
        <StatsSection />
      </div>
    </div>
  );
}
