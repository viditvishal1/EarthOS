/** Provider SLO targets for health reporting (Phase 8). */

export const PROVIDER_SLO_SECONDS: Record<string, number> = {
  flights: 180,
  ships: 180,
  iss: 120,
  cctv: 600,
  markets: 3600,
  macro: 3600,
  observations: 600,
  satellites: 7200,
};

export function sloState(ageSeconds: number | null, targetSeconds: number): "fresh" | "stale" | "missing" {
  if (ageSeconds == null) return "missing";
  if (ageSeconds <= targetSeconds) return "fresh";
  if (ageSeconds <= targetSeconds * 3) return "stale";
  return "missing";
}
