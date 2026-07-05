import type { DashboardLayout } from "@/lib/panels/types";

export const DEFAULT_INTELLIGENCE_LAYOUT: DashboardLayout = {
  id: "intelligence-default",
  name: "Intelligence",
  version: 1,
  panels: [
    { id: "p-globe", panelKey: "globe-map", x: 0, y: 0, w: 12, h: 8 },
    { id: "p-timeline", panelKey: "event-timeline", x: 0, y: 8, w: 4, h: 5 },
    { id: "p-wire", panelKey: "wire-headlines", x: 4, y: 8, w: 4, h: 4 },
    { id: "p-markets", panelKey: "markets-snapshot", x: 8, y: 8, w: 4, h: 4 },
    { id: "p-monitors", panelKey: "my-monitors", x: 0, y: 13, w: 4, h: 4 },
    { id: "p-cameras", panelKey: "cameras", x: 4, y: 12, w: 4, h: 4 },
  ],
};

export const DEFAULT_AVIATION_LAYOUT: DashboardLayout = {
  id: "aviation-default",
  name: "Aviation",
  version: 1,
  panels: [
    { id: "p-globe", panelKey: "globe-map", x: 0, y: 0, w: 8, h: 8 },
    { id: "p-aviation", panelKey: "aviation-status", x: 8, y: 0, w: 4, h: 4 },
    { id: "p-health", panelKey: "provider-health", x: 8, y: 4, w: 4, h: 4 },
  ],
};

export const DASHBOARD_PRESETS: Record<string, DashboardLayout> = {
  intelligence: DEFAULT_INTELLIGENCE_LAYOUT,
  aviation: DEFAULT_AVIATION_LAYOUT,
};

export const STORAGE_KEY = "argus:dashboard-layout:v1";

export function loadLayoutFromStorage(): DashboardLayout | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DashboardLayout;
  } catch {
    return null;
  }
}

export function saveLayoutToStorage(layout: DashboardLayout): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}
