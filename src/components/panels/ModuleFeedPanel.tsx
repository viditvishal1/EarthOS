"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Item } from "@/lib/types";
import { timeAgo } from "@/components/ModuleView";
import { Badge } from "@/components/Badge";

async function fetchModules(modules: string[]): Promise<Item[]> {
  const batches = await Promise.all(
    modules.map((m) =>
      fetch(`/api/modules/${m}`)
        .then((r) => r.json())
        .then((d) => (d.items ?? []) as Item[])
        .catch(() => [] as Item[]),
    ),
  );
  return batches.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function ModuleFeedPanel({
  modules,
  minSeverity,
  moduleOnly,
  emptyLabel = "No items yet",
  showSeverity = false,
  linkHref,
}: {
  modules: string[];
  minSeverity?: number;
  moduleOnly?: string;
  emptyLabel?: string;
  showSeverity?: boolean;
  linkHref?: string;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const key = `${modules.join(",")}|${minSeverity ?? ""}|${moduleOnly ?? ""}`;

  useEffect(() => {
    fetchModules(modules).then((all) => {
      let next = all;
      if (moduleOnly) next = next.filter((i) => i.module === moduleOnly);
      if (minSeverity != null) next = next.filter((i) => (i.severity ?? 0) >= minSeverity);
      setItems(next.slice(0, 30));
    });
  }, [key, modules, minSeverity, moduleOnly]);

  if (!items.length) {
    return <p className="text-[11px] text-ink-dim">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((i) => (
        <a
          key={i.id}
          href={i.url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="rounded-md px-2 py-1.5 hover:bg-panel-2"
        >
          <div className="flex items-center gap-2">
            {showSeverity && (i.severity ?? 0) > 0 && (
              <Badge tone={(i.severity ?? 0) >= 6 ? "critical" : "warning"}>
                {(i.severity ?? 0).toFixed(1)}
              </Badge>
            )}
            <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{i.title}</span>
          </div>
          <div className="mt-0.5 text-[10px] text-ink-dim">
            {i.source} · {i.module} · {timeAgo(i.timestamp)}
          </div>
        </a>
      ))}
      {linkHref && (
        <Link href={linkHref} className="mt-1 px-2 text-[11px] text-accent hover:underline">
          Open module →
        </Link>
      )}
    </div>
  );
}
