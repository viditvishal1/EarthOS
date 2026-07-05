"use client";

import { GlobeDashboard } from "@/components/GlobeDashboard";

export default function DashboardPage() {
  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col md:-m-6">
      <GlobeDashboard variant="dashboard" fullBleed region="global" />
    </div>
  );
}
