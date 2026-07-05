"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardLayout, PanelInstance } from "@/lib/panels/types";
import { getPanel } from "@/lib/panels/registry";
import { DEFAULT_INTELLIGENCE_LAYOUT, loadLayoutFromStorage, saveLayoutToStorage } from "@/lib/panels/defaults";
import { PanelContent } from "@/components/dashboard/PanelContent";
import { PanelCatalog } from "@/components/dashboard/PanelCatalog";

const COLS = 12;
const ROW_H = 48;

export function DashboardGrid({ preset = "intelligence" }: { preset?: string }) {
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_INTELLIGENCE_LAYOUT);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => {
    const stored = loadLayoutFromStorage();
    if (stored) setLayout(stored);
    else if (preset === "aviation") {
      import("@/lib/panels/defaults").then((m) => setLayout(m.DEFAULT_AVIATION_LAYOUT));
    }
  }, [preset]);

  const persist = useCallback((next: DashboardLayout) => {
    setLayout(next);
    saveLayoutToStorage(next);
  }, []);

  const removePanel = (id: string) => {
    persist({ ...layout, panels: layout.panels.filter((p) => p.id !== id) });
  };

  const addPanel = (panelKey: string) => {
    const def = getPanel(panelKey);
    if (!def) return;
    const instance: PanelInstance = {
      id: `p-${panelKey}-${Date.now()}`,
      panelKey,
      x: 0,
      y: Math.max(0, ...layout.panels.map((p) => p.y + p.h), 0),
      w: def.defaultSize.w,
      h: def.defaultSize.h,
    };
    persist({ ...layout, panels: [...layout.panels, instance] });
    setCatalogOpen(false);
  };

  const maxRow = layout.panels.reduce((m, p) => Math.max(m, p.y + p.h), 4);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-line px-3 py-2">
        <div>
          <h1 className="text-sm font-semibold text-ink">{layout.name} Dashboard</h1>
          <p className="text-[10px] text-ink-dim">Drag-free grid · layouts persist locally</p>
        </div>
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="rounded-md border border-line bg-panel-2 px-3 py-1.5 text-[11px] text-ink hover:bg-panel"
        >
          + Add panel
        </button>
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-auto p-2"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridAutoRows: `${ROW_H}px`,
          gap: "8px",
          minHeight: maxRow * ROW_H + 16,
        }}
      >
        {layout.panels.map((inst) => {
          const def = getPanel(inst.panelKey);
          if (!def) return null;
          return (
            <div
              key={inst.id}
              className="min-h-0 min-w-0"
              style={{
                gridColumn: `${inst.x + 1} / span ${Math.min(inst.w, COLS - inst.x)}`,
                gridRow: `span ${inst.h}`,
              }}
            >
              <PanelContent instance={inst} definition={def} onClose={() => removePanel(inst.id)} />
            </div>
          );
        })}
      </div>

      {catalogOpen && (
        <PanelCatalog
          onAdd={addPanel}
          onClose={() => setCatalogOpen(false)}
          existingKeys={layout.panels.map((p) => p.panelKey)}
        />
      )}
    </div>
  );
}
