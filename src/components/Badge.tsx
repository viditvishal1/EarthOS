"use client";

// Shared status chip — consolidates the ad-hoc severity colors scattered
// through the module pages into one component keyed on the design-system
// status tokens (live/critical/warning/info/neutral).

type Tone = "live" | "critical" | "warning" | "info" | "neutral";

const TONE_CLASSES: Record<Tone, string> = {
  live: "bg-live/12 text-live",
  critical: "bg-critical/12 text-critical",
  warning: "bg-warning/12 text-warning",
  info: "bg-info/12 text-info",
  neutral: "bg-panel-2 text-ink-dim",
};

export function Badge({
  tone = "neutral",
  pulse = false,
  children,
}: {
  tone?: Tone;
  pulse?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TONE_CLASSES[tone]}`}
    >
      {pulse && <span className="hud-pulse h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
