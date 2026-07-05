"use client";

import { useEffect, useState } from "react";
import { listVariants } from "@/lib/variants/registry";
import type { VariantId } from "@/lib/variants/types";

export function VariantSwitcher() {
  const variants = listVariants(true);
  const [active, setActive] = useState<VariantId>("world");

  useEffect(() => {
    const saved = localStorage.getItem("argus_variant") as VariantId | null;
    if (saved && variants.some((v) => v.id === saved)) setActive(saved);
  }, [variants]);

  const onChange = (id: VariantId) => {
    setActive(id);
    localStorage.setItem("argus_variant", id);
    document.cookie = `argus_variant=${id};path=/;max-age=31536000`;
  };

  return (
    <div className="mb-3 hidden px-2 lg:block">
      <div className="text-[9px] uppercase tracking-widest text-ink-dim">Variant</div>
      <select
        value={active}
        onChange={(e) => onChange(e.target.value as VariantId)}
        className="mt-1 w-full rounded-md border border-line bg-panel-2 px-2 py-1 text-[11px] text-ink"
        aria-label="Product variant"
      >
        {variants.map((v) => (
          <option key={v.id} value={v.id}>{v.label}</option>
        ))}
      </select>
    </div>
  );
}
