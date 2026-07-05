"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/Badge";

export function PanelShell({
  title,
  freshness,
  source,
  stale,
  children,
  onClose,
  actions,
}: {
  title: string;
  freshness?: string;
  source?: string;
  stale?: boolean;
  children: ReactNode;
  onClose?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="panel flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <div className="panel-header shrink-0 gap-2">
        <span className="min-w-0 truncate normal-case tracking-normal text-xs font-medium text-ink">{title}</span>
        <div className="flex shrink-0 items-center gap-2">
          {stale && <Badge tone="warning">Stale</Badge>}
          {freshness && <span className="mono text-[9px] text-ink-dim">{freshness}</span>}
          {source && <Badge tone="info">{source}</Badge>}
          {actions}
          {onClose && (
            <button type="button" onClick={onClose} className="text-ink-dim hover:text-ink" aria-label="Close panel">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">{children}</div>
    </div>
  );
}
