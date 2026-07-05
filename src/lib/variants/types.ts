export type VariantId = "world" | "finance" | "tech" | "commodity" | "energy" | "happy";

export interface VariantDefinition {
  id: VariantId;
  label: string;
  description: string;
  /** Panel keys enabled for this variant (subset of PANEL_REGISTRY). */
  panels: string[];
  /** Map layer ids from LayerRegistry. */
  mapLayers: string[];
  /** Module routes shown in primary nav. */
  modules: string[];
  themeAccent: string;
  defaultPath: string;
  /** Postponed variants return false — UI shows "coming soon". */
  enabled: boolean;
}
