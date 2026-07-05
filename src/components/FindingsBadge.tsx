"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radar } from "lucide-react";

export function FindingsBadge({ className }: { className?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/v1/findings?limit=30")
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0))
      .catch(() => setCount(0));
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/"
      className={`inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent ${className ?? ""}`}
      title="Cross-domain findings"
    >
      <Radar className="h-3 w-3" />
      {count} findings
    </Link>
  );
}
