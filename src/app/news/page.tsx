"use client";

// News Intelligence — country-wise and category-wise chips on top of the
// universal filter bar. Chips write the same URL filter params (freg/ftag),
// so chip-filtered views stay shareable like every other filtered view.

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ModuleView } from "@/components/ModuleView";

const COUNTRIES = ["United States", "India", "United Kingdom", "Australia", "Canada", "Singapore", "UAE", "Global"];
const CATEGORIES = ["world", "business", "technology", "science", "sports", "health", "entertainment", "headlines"];

function Chips() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const selRegions = sp.get("freg")?.split("|").filter(Boolean) ?? [];
  const selTags = sp.get("ftag")?.split("|").filter(Boolean) ?? [];

  const toggle = (key: "freg" | "ftag", value: string, current: string[]) => {
    const next = current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
    const p = new URLSearchParams(sp.toString());
    if (next.length) p.set(key, next.join("|"));
    else p.delete(key);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  };

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] capitalize transition-colors ${
        on ? "border-accent/60 bg-panel-2 text-accent" : "border-line text-ink-dim hover:text-ink"
      }`}
      aria-pressed={on}
    >
      {label}
    </button>
  );

  return (
    <div className="mb-3 flex flex-col gap-1.5 rounded-lg border border-line bg-panel p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-16 text-[11px] uppercase tracking-wide text-ink-dim">Country</span>
        {COUNTRIES.map((c) => chip(c, selRegions.includes(c), () => toggle("freg", c, selRegions)))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-16 text-[11px] uppercase tracking-wide text-ink-dim">Category</span>
        {CATEGORIES.map((c) => chip(c, selTags.includes(c), () => toggle("ftag", c, selTags)))}
      </div>
    </div>
  );
}

export default function NewsPage() {
  return (
    <ModuleView
      module="news"
      title="News Intelligence"
      subtitle="Outlet feeds with in-app article extraction + Google News editions by country and category"
      refreshSeconds={300}
      extraHeader={
        <Suspense fallback={null}>
          <Chips />
        </Suspense>
      }
    />
  );
}
