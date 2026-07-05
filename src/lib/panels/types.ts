/**
 * Panel registry — World Monitor-inspired layout system without premium coupling.
 */

export type PanelCategory =
  | "map"
  | "news"
  | "crisis"
  | "aviation"
  | "maritime"
  | "space"
  | "markets"
  | "cyber"
  | "system";

export type PanelMobilePolicy = "enabled" | "collapsed" | "disabled";

export interface PanelSize {
  w: number;
  h: number;
}

export interface PanelDefinition {
  key: string;
  title: string;
  category: PanelCategory;
  /** Dynamic import path resolved at runtime. */
  componentId: string;
  defaultSize: PanelSize;
  minSize: PanelSize;
  dataDependencies: string[];
  supportedLayers?: string[];
  mobile: PanelMobilePolicy;
  description?: string;
}

export interface PanelInstance {
  id: string;
  panelKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tabGroup?: string;
  config?: Record<string, unknown>;
}

export interface DashboardLayout {
  id: string;
  name: string;
  panels: PanelInstance[];
  version: number;
}

export interface PanelProps {
  instanceId: string;
  config?: Record<string, unknown>;
  onClose?: () => void;
}
