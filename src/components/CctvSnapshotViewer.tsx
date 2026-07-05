"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/** Auto-refreshing traffic-cam snapshot — agency feeds are still images, not video streams. */
export function CctvSnapshotViewer({
  imageUrl,
  title,
  refreshSeconds = 120,
  className,
}: {
  imageUrl: string;
  title: string;
  refreshSeconds?: number;
  className?: string;
}) {
  const [tick, setTick] = useState(0);
  const [error, setError] = useState(false);
  const mins = Math.max(1, Math.round(refreshSeconds / 60));

  useEffect(() => {
    setError(false);
    const ms = Math.max(refreshSeconds, 30) * 1000;
    const t = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [imageUrl, refreshSeconds]);

  const src = `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}_argus=${tick}`;

  return (
    <div className={`overflow-hidden rounded-md border border-line bg-black ${className ?? ""}`}>
      {!error ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={title}
          className="aspect-video w-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <div className="flex aspect-video items-center justify-center text-xs text-ink-dim">
          Snapshot unavailable
        </div>
      )}
      <div className="flex items-center justify-between border-t border-line bg-panel px-2 py-1 text-[10px] text-ink-dim">
        <span>Traffic cam snapshot · refreshes ~every {mins} min</span>
        <button
          type="button"
          onClick={() => { setError(false); setTick((n) => n + 1); }}
          className="flex items-center gap-0.5 hover:text-accent"
          aria-label="Refresh snapshot"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>
    </div>
  );
}
