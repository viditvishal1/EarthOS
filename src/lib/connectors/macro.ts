// Macro / economics connectors — World Bank headline indicators (keyless),
// FRED US series (free key), EIA energy spot prices (free key). Gives markets
// and Entity 360 views fundamental context: growth, inflation, rates, energy.

import type { Item } from "@/lib/types";
import { fetchWithTimeout, registerConnector } from "./framework";

// The World Bank API only accepts one country per request reliably — fan out
// per country×indicator (cached for a day by the connector schedule).
const WB_COUNTRIES = ["USA", "CHN", "IND", "DEU", "GBR", "JPN", "BRA"];
const WB_INDICATORS: { code: string; label: string; unit: string }[] = [
  { code: "NY.GDP.MKTP.KD.ZG", label: "GDP growth", unit: "% y/y" },
  { code: "FP.CPI.TOTL.ZG", label: "Inflation (CPI)", unit: "% y/y" },
  { code: "SL.UEM.TOTL.ZS", label: "Unemployment", unit: "% of labor force" },
];

registerConnector(
  {
    id: "worldbank_indicators",
    module: "macro",
    source: "World Bank",
    sourceUrl: "https://data.worldbank.org",
    scheduleSeconds: 86400,
    contentPolicy: "full_cache",
    entityTypes: ["location"],
  },
  async () => {
    interface WbRow {
      country: { id: string; value: string };
      date: string;
      value: number | null;
    }
    const tasks = WB_INDICATORS.flatMap((ind) =>
      WB_COUNTRIES.map(async (iso3): Promise<Item | null> => {
        const res = await fetchWithTimeout(
          `https://api.worldbank.org/v2/country/${iso3}/indicator/${ind.code}?format=json&mrnev=1`,
          { timeoutMs: 12000 },
        ).catch(() => null);
        if (!res?.ok) return null;
        const data = await res.json().catch(() => null);
        const r = (Array.isArray(data) && Array.isArray(data[1]) ? data[1][0] : null) as WbRow | null;
        if (!r || r.value == null) return null;
        return {
          id: `wb:${ind.code}:${iso3}`,
          module: "macro",
          connectorId: "worldbank_indicators",
          title: `${r.country.value} — ${ind.label}: ${r.value.toFixed(1)}${ind.unit.startsWith("%") ? "%" : ""}`,
          summary: `${ind.label} (${ind.unit}), latest available year ${r.date}. Source: World Bank open data.`,
          url: `https://data.worldbank.org/indicator/${ind.code}?locations=${iso3}`,
          source: "World Bank",
          timestamp: new Date(`${r.date}-12-31`).toISOString(),
          severity: ind.code === "FP.CPI.TOTL.ZG" ? Math.min(10, Math.abs(r.value) / 2) : undefined,
          severityLabel: `${r.value.toFixed(1)}${ind.unit.startsWith("%") ? "%" : ""}`,
          tags: ["macro", ind.label.toLowerCase().replace(/[^a-z]+/g, "-")],
          region: r.country.value,
          entities: [{ name: r.country.value, type: "location" }],
          contentPolicy: "full_cache",
          extra: { indicator: ind.code, value: r.value, year: r.date },
        };
      }),
    );
    const results = await Promise.all(tasks);
    return results.filter((i): i is Item => i !== null);
  },
);

const FRED_SERIES: { id: string; label: string; unit: string }[] = [
  { id: "DFF", label: "Fed Funds Rate", unit: "%" },
  { id: "UNRATE", label: "US Unemployment", unit: "%" },
  { id: "DGS10", label: "US 10Y Treasury", unit: "%" },
  { id: "T10Y2Y", label: "10Y–2Y Spread", unit: "pp" },
  { id: "VIXCLS", label: "VIX", unit: "" },
];

registerConnector(
  {
    id: "fred_series",
    module: "macro",
    source: "FRED",
    sourceUrl: "https://fred.stlouisfed.org",
    scheduleSeconds: 3600,
    contentPolicy: "full_cache",
    entityTypes: ["instrument"],
    requiresKey: "FRED_API_KEY",
  },
  async () => {
    const key = process.env.FRED_API_KEY!;
    const items: Item[] = [];
    for (const s of FRED_SERIES) {
      const res = await fetchWithTimeout(
        `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${key}&file_type=json&sort_order=desc&limit=1`,
        { timeoutMs: 10000 },
      );
      if (!res.ok) continue;
      const data = await res.json();
      const obs = data.observations?.[0];
      if (!obs || obs.value === ".") continue;
      const value = Number(obs.value);
      items.push({
        id: `fred:${s.id}`,
        module: "macro",
        connectorId: "fred_series",
        title: `${s.label}: ${value}${s.unit}`,
        summary: `FRED series ${s.id}, observation date ${obs.date}.`,
        url: `https://fred.stlouisfed.org/series/${s.id}`,
        source: "FRED",
        timestamp: new Date(obs.date).toISOString(),
        severityLabel: `${value}${s.unit}`,
        tags: ["macro", "us", "rates"],
        entities: [{ name: s.label, type: "instrument" }],
        contentPolicy: "full_cache",
        extra: { series: s.id, value },
      });
    }
    return items;
  },
);

registerConnector(
  {
    id: "eia_energy",
    module: "macro",
    source: "EIA",
    sourceUrl: "https://www.eia.gov",
    scheduleSeconds: 3600,
    contentPolicy: "full_cache",
    entityTypes: ["instrument"],
    requiresKey: "EIA_API_KEY",
  },
  async () => {
    const key = process.env.EIA_API_KEY!;
    const res = await fetchWithTimeout(
      `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${key}&frequency=daily&data[0]=value&facets[series][]=RWTC&facets[series][]=RBRTE&sort[0][column]=period&sort[0][direction]=desc&length=2`,
      { timeoutMs: 12000 },
    );
    if (!res.ok) throw new Error(`EIA HTTP ${res.status}`);
    const data = await res.json();
    interface EiaRow { period: string; series: string; value: number; "series-description"?: string }
    const label: Record<string, string> = { RWTC: "WTI Crude Spot", RBRTE: "Brent Crude Spot" };
    return ((data.response?.data ?? []) as EiaRow[]).map((r): Item => ({
      id: `eia:${r.series}`,
      module: "macro",
      connectorId: "eia_energy",
      title: `${label[r.series] ?? r.series}: $${r.value}/bbl`,
      summary: `${r["series-description"] ?? r.series}, ${r.period}. Source: US EIA.`,
      url: "https://www.eia.gov/petroleum/data.php",
      source: "EIA",
      timestamp: new Date(r.period).toISOString(),
      severityLabel: `$${r.value}`,
      tags: ["macro", "energy", "oil"],
      entities: [{ name: label[r.series] ?? r.series, type: "instrument" }],
      contentPolicy: "full_cache",
      extra: { series: r.series, value: r.value },
    }));
  },
);

export const MACRO_CONNECTOR_IDS = ["worldbank_indicators", "fred_series", "eia_energy"];
