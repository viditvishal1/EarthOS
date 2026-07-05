"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";

type FreshnessState = "fresh" | "stale" | "missing" | "error";

const TONE: Record<FreshnessState, string> = {
  fresh: "text-live border-live/40 bg-live/10",
  stale: "text-amber-400 border-amber-800/50 bg-amber-950/40",
  missing: "text-ink-dim border-line bg-panel",
  error: "text-critical border-critical/40 bg-critical/10",
};

export function FreshnessBadge({ className }: { className?: string }) {
  const [state, setState] = useState<FreshnessState>("missing");
  const [gaps, setGaps] = useState(0);

  useEffect(() => {
    fetch("/api/v1/freshness")
      .then((r) => r.json())
      .then((d) => {
        setState(d.overall ?? "missing");
        setGaps((d.intelligenceGaps ?? []).length);
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <Link
      href="/admin/sources"
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${TONE[state]} ${className ?? ""}`}
      title={gaps > 0 ? `${gaps} intelligence gap(s)` : "Source freshness"}
    >
      <Activity className="h-3 w-3" />
      {state}
      {gaps > 0 && <span className="mono">· {gaps} gaps</span>}
    </Link>
  );
}
