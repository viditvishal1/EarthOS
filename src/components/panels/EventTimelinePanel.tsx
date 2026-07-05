"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/components/ModuleView";
import { Badge } from "@/components/Badge";

interface Cluster {
  id: string;
  canonicalTitle: string;
  memberCount: number;
  sources: string[];
  latestAt: string;
}

export function EventTimelinePanel() {
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [freshness, setFreshness] = useState<string>("");

  useEffect(() => {
    fetch("/api/v1/observations?cluster=true&limit=40")
      .then((r) => r.json())
      .then((d) => {
        setClusters(d.clusters ?? []);
        setFreshness(d.dataFreshness ?? "");
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-1 flex items-center gap-2">
        <Badge tone={freshness === "fresh" ? "live" : "warning"}>{freshness || "loading"}</Badge>
        <span className="text-[9px] text-ink-dim">Corroboration count · not a truth score</span>
      </div>
      {clusters.map((c) => (
        <div key={c.id} className="rounded-md border border-line/60 px-2 py-1.5 hover:bg-panel-2">
          <div className="text-[12px] text-ink">{c.canonicalTitle}</div>
          <div className="mt-0.5 text-[10px] text-ink-dim">
            {c.memberCount} source{c.memberCount === 1 ? "" : "s"} · {c.sources.join(", ")} · {timeAgo(c.latestAt)}
          </div>
        </div>
      ))}
      {!clusters.length && <p className="text-[11px] text-ink-dim">Loading event clusters…</p>}
    </div>
  );
}
