"use client";

import { useEffect, useState } from "react";
import type { Item } from "@/lib/types";
import type { FlightEnrichment } from "@/lib/aviation/adsb-enrichment";
import { detectEntityKind } from "@/lib/entity/detail";

/** Fetch live adsb.lol enrichment when a flight is selected. */
export function useFlightEnrichment(item: Item | null): {
  enrichment: FlightEnrichment | null;
  loading: boolean;
} {
  const [enrichment, setEnrichment] = useState<FlightEnrichment | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item || detectEntityKind(item) !== "flight") {
      setEnrichment(null);
      setLoading(false);
      return;
    }

    const icao = String(item.extra?.icao24 ?? item.id.replace("flight:", "")).toLowerCase();
    if (!icao) {
      setEnrichment(null);
      return;
    }

    let alive = true;
    setLoading(true);

    fetch(`/api/v1/flights/${encodeURIComponent(icao)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        setEnrichment(data as FlightEnrichment | null);
      })
      .catch(() => alive && setEnrichment(null))
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [item?.id, item]);

  return { enrichment, loading };
}
