"use client";

import { ExternalLink, X } from "lucide-react";
import type { Item } from "@/lib/types";
import { Badge } from "@/components/Badge";
import { EntityChip } from "@/components/EntityChip";
import {
  detectEntityKind,
  entityKindLabel,
  extractEntityFields,
} from "@/lib/entity/detail";

function SeverityBadge({ item }: { item: Item }) {
  if (!item.severityLabel) return null;
  const sev = item.severity ?? 0;
  const color =
    sev >= 8 ? "bg-red-950 text-red-300 border-red-800"
    : sev >= 6 ? "bg-orange-950 text-orange-300 border-orange-800"
    : sev >= 4 ? "bg-amber-950 text-amber-300 border-amber-800"
    : "bg-panel text-ink-dim border-line";
  return (
    <span className={`mono rounded border px-1.5 py-0.5 text-[11px] ${color}`}>
      {item.severityLabel}
    </span>
  );
}

function PreviewMedia({ item }: { item: Item }) {
  const kind = detectEntityKind(item);
  const imageUrl =
    (typeof item.extra?.imageUrl === "string" ? item.extra.imageUrl : null)
    ?? (kind === "webcam" && item.url ? item.url : null);

  if (!imageUrl) return null;

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-line">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={item.title}
        className="aspect-video w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}

function MetadataGrid({ fields }: { fields: { label: string; value: string; mono?: boolean }[] }) {
  return (
    <dl className="grid grid-cols-[minmax(5.5rem,auto)_1fr] gap-x-3 gap-y-1.5 text-[11px]">
      {fields.map((f) => (
        <div key={f.label} className="contents">
          <dt className="text-ink-dim">{f.label}</dt>
          <dd className={`text-ink ${f.mono ? "mono" : ""}`}>{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EntityDetailPanel({
  item,
  onClose,
  className,
}: {
  item: Item;
  onClose: () => void;
  className?: string;
}) {
  const kind = detectEntityKind(item);
  const fields = extractEntityFields(item);
  const showSummary = item.summary && item.summary !== item.title;

  return (
    <div
      className={`hud-window flex max-h-[min(72vh,560px)] flex-col overflow-hidden rounded-lg shadow-xl sm:max-h-[min(68vh,520px)] ${className ?? ""}`}
      role="dialog"
      aria-label={`${entityKindLabel(kind)} details`}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-line px-3 py-2.5">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="mono text-[10px] uppercase tracking-widest text-accent">
              {entityKindLabel(kind)}
            </span>
            <SeverityBadge item={item} />
            <Badge tone="info">{item.source}</Badge>
          </div>
          <h2 className="truncate text-[15px] font-semibold leading-snug text-ink">{item.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md border border-line p-1 text-ink-dim hover:text-ink"
          aria-label="Close detail panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <PreviewMedia item={item} />

        {showSummary && (
          <p className="mb-3 text-[12px] leading-relaxed text-soft">{item.summary}</p>
        )}

        {item.body && (
          <pre className="mb-3 whitespace-pre-wrap text-[12px] leading-relaxed text-soft">
            {item.body}
          </pre>
        )}

        <MetadataGrid fields={fields} />

        {item.entities.length > 0 && (
          <div className="mt-3 border-t border-line pt-2.5">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-ink-dim">Linked entities</div>
            <div className="flex flex-wrap gap-1">
              {item.entities.map((e) => (
                <EntityChip key={`${e.type}:${e.name}`} name={e.name} type={e.type} />
              ))}
            </div>
          </div>
        )}

        {(kind === "webcam" || kind === "cctv") && item.url && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            Open live feed <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-line px-3 py-2 text-[10px] text-ink-dim">
        <span className="mono truncate">{item.id}</span>
        {item.url && kind !== "webcam" && kind !== "cctv" && (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="flex shrink-0 items-center gap-1 hover:text-accent"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
