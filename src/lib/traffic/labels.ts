import type { TrafficFlowSegment } from "@/lib/traffic/types";

export type CongestionLevel = "clear" | "moderate" | "heavy" | "standstill";

export function speedRatio(seg: Pick<TrafficFlowSegment, "currentSpeed" | "freeFlowSpeed">): number {
  if (seg.freeFlowSpeed <= 0) return 1;
  return seg.currentSpeed / seg.freeFlowSpeed;
}

export function congestionLevel(ratio: number): CongestionLevel {
  if (ratio < 0.3) return "standstill";
  if (ratio < 0.5) return "heavy";
  if (ratio < 0.75) return "moderate";
  return "clear";
}

export function congestionLabel(level: CongestionLevel): string {
  switch (level) {
    case "standstill":
      return "Standstill / possible signal delay";
    case "heavy":
      return "Heavy traffic";
    case "moderate":
      return "Moderate traffic";
    case "clear":
      return "Clear";
  }
}

export function lineColorForRatio(ratio: number): string {
  if (ratio < 0.3) return "#b91c1c";
  if (ratio < 0.5) return "#ef4444";
  if (ratio < 0.75) return "#f59e0b";
  return "#22c55e";
}

/** Human-readable headline for a traffic segment card. */
export function trafficCardTitle(seg: TrafficFlowSegment): string {
  const ratio = speedRatio(seg);
  const level = congestionLevel(ratio);
  const label = congestionLabel(level);
  const road = seg.roadName?.trim();
  if (road) return `${label} · ${road}`;
  return label;
}

export function trafficCardSubtitle(seg: TrafficFlowSegment): string {
  const cur = Math.round(seg.currentSpeed);
  const free = Math.round(seg.freeFlowSpeed);
  return `${cur} km/h (free flow ${free} km/h)`;
}
