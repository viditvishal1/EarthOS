"use client";

import { listPanels } from "@/lib/panels/registry";

export function PanelCatalog({
  onAdd,
  onClose,
  existingKeys,
}: {
  onAdd: (key: string) => void;
  onClose: () => void;
  existingKeys: string[];
}) {
  const panels = listPanels();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="hud-window max-h-[80vh] w-full max-w-lg overflow-hidden rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <span className="text-sm font-medium text-ink">Add panel</span>
          <button type="button" onClick={onClose} className="text-ink-dim hover:text-ink">✕</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {panels.map((p) => {
            const exists = existingKeys.includes(p.key);
            return (
              <button
                key={p.key}
                type="button"
                disabled={exists}
                onClick={() => onAdd(p.key)}
                className="mb-1 flex w-full flex-col rounded-md border border-line px-3 py-2 text-left hover:bg-panel-2 disabled:opacity-40"
              >
                <span className="text-[12px] font-medium text-ink">{p.title}</span>
                <span className="text-[10px] capitalize text-ink-dim">{p.category} · {p.description ?? p.componentId}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
