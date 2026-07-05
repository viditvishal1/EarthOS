"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Download, LoaderCircle } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Badge } from "@/components/Badge";

interface CountryBrief {
  iso2: string;
  country: string;
  region: string;
  cii: {
    score: number;
    band: string;
    coverageState: string;
    intelligenceGaps: string[];
    components: { label: string; score: number; evidenceCount: number }[];
    methodologyVersion: string;
  };
  findings: { title: string; summary: string; signalType: string }[];
  timeline: { id: string; title: string; source: string; timestamp: string; module: string }[];
  brief: { text: string; provider: string; model: string } | null;
  disclaimer: string;
}

function bandTone(band: string): "critical" | "warning" | "info" | "live" {
  if (band === "critical" || band === "high") return "critical";
  if (band === "elevated") return "warning";
  if (band === "low") return "live";
  return "info";
}

export default function CountryBriefPage({ params }: { params: Promise<{ iso2: string }> }) {
  const [iso2, setIso2] = useState("");
  const [data, setData] = useState<CountryBrief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setIso2(p.iso2.toUpperCase()));
  }, [params]);

  useEffect(() => {
    if (!iso2) return;
    setLoading(true);
    fetch(`/api/v1/country/${iso2}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load country brief"))
      .finally(() => setLoading(false));
  }, [iso2]);

  const exportMarkdown = () => {
    if (!data) return;
    const md = [
      `# Country Brief — ${data.country} (${data.iso2})`,
      "",
      `**CII ${data.cii.methodologyVersion}:** ${data.cii.score}/100 (${data.cii.band}) · coverage: ${data.cii.coverageState}`,
      "",
      "## Components",
      ...data.cii.components.map((c) => `- ${c.label}: ${c.score.toFixed(1)} (${c.evidenceCount} items)`),
      "",
      "## Findings",
      ...data.findings.map((f) => `- **${f.title}** — ${f.summary}`),
      "",
      data.brief?.text ? `## AI Brief (${data.brief.provider})\n\n${data.brief.text}` : "",
      "",
      `_${data.disclaimer}_`,
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `country-brief-${data.iso2}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-ink-dim">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading country brief…
      </div>
    );
  }

  if (error || !data) {
    return <div className="p-8 text-sm text-critical">{error ?? "Country not found"}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-ink-dim">Country Brief</p>
          <h1 className="text-2xl font-semibold text-ink">{data.country}</h1>
          <p className="text-sm text-ink-dim">{data.region} · {data.iso2}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={bandTone(data.cii.band)}>CII {data.cii.score} — {data.cii.band}</Badge>
          <button
            type="button"
            onClick={exportMarkdown}
            className="flex items-center gap-1 rounded-md border border-line px-2.5 py-1.5 text-xs text-ink-dim hover:text-ink"
          >
            <Download className="h-3.5 w-3.5" /> Export MD
          </button>
        </div>
      </div>

      {data.cii.intelligenceGaps.length > 0 && (
        <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
          <div className="mb-1 flex items-center gap-1 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" /> Intelligence gaps
          </div>
          <ul className="list-inside list-disc">
            {data.cii.intelligenceGaps.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </div>
      )}

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-sm font-medium text-ink">CII components ({data.cii.methodologyVersion})</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {data.cii.components.map((c) => (
            <div key={c.label} className="rounded-md border border-line px-3 py-2">
              <dt className="text-xs text-ink-dim">{c.label}</dt>
              <dd className="mono text-lg font-semibold text-ink">{c.score.toFixed(1)}</dd>
              <dd className="text-[10px] text-ink-dim">{c.evidenceCount} evidence items</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[10px] text-ink-dim">{data.disclaimer}</p>
      </section>

      {data.brief?.text && (
        <section className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-2 text-sm font-medium text-ink">
            Situational brief <span className="text-ink-dim">({data.brief.provider})</span>
          </h2>
          <Markdown text={data.brief.text} />
        </section>
      )}

      {data.findings.length > 0 && (
        <section className="rounded-lg border border-line bg-panel p-4">
          <h2 className="mb-3 text-sm font-medium text-ink">Active findings</h2>
          <ul className="space-y-2">
            {data.findings.map((f) => (
              <li key={f.title} className="border-b border-line pb-2 last:border-0">
                <div className="text-xs uppercase text-accent">{f.signalType.replace(/_/g, " ")}</div>
                <div className="font-medium text-ink">{f.title}</div>
                <div className="text-sm text-soft">{f.summary}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-3 text-sm font-medium text-ink">7-day evidence timeline</h2>
        <ul className="space-y-2">
          {data.timeline.length === 0 ? (
            <li className="text-sm text-ink-dim">No geolocated items for this country in current cache.</li>
          ) : data.timeline.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-2 text-sm last:border-0">
              <span className="text-ink">{t.title}</span>
              <span className="mono text-[10px] text-ink-dim">{t.module} · {t.source} · {new Date(t.timestamp).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-center text-xs text-ink-dim">
        <Link href="/graph" className="text-accent hover:underline">Knowledge graph</Link>
        {" · "}
        <Link href="/investigations" className="text-accent hover:underline">Investigations</Link>
      </p>
    </div>
  );
}
