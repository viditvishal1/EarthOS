"use client";

// Space — live ISS/Kp stats, intelligence feed, orbit globe (SGP4 TLEs),
// and a scrubbable solar-system view.

import { useEffect, useState } from "react";
import { Globe2, Orbit, Satellite } from "lucide-react";
import { ModuleView } from "@/components/ModuleView";
import { OrbitGlobe } from "@/components/OrbitGlobe";
import { SolarSystem } from "@/components/SolarSystem";

type Tab = "intel" | "orbit" | "solar";

function LiveStats() {
  const [iss, setIss] = useState<{ lat: number; lon: number; altitudeKm?: number; velocityKmh?: number } | null>(null);
  const [kp, setKp] = useState<number | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/iss").then((r) => r.json()).then((d) => typeof d.lat === "number" && setIss(d));
      fetch("/api/kindex").then((r) => r.json()).then((d) => typeof d.kp === "number" && setKp(d.kp));
    };
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, []);

  const kpTone = (kp ?? 0) >= 7 ? "text-red-400" : (kp ?? 0) >= 5 ? "text-orange-400" : "text-violet-300";

  return (
    <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-dim">
          <Satellite className="h-3 w-3" /> ISS position
        </div>
        <div className="mono mt-1 text-sm text-ink">
          {iss ? `${iss.lat.toFixed(2)}°, ${iss.lon.toFixed(2)}°` : "—"}
        </div>
      </div>
      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="text-[11px] uppercase tracking-wide text-ink-dim">ISS altitude / speed</div>
        <div className="mono mt-1 text-sm text-ink">
          {iss?.altitudeKm != null ? `${iss.altitudeKm.toFixed(0)} km · ${iss.velocityKmh?.toFixed(0)} km/h` : "—"}
        </div>
      </div>
      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="text-[11px] uppercase tracking-wide text-ink-dim">Planetary K-index</div>
        <div className={`mono mt-1 text-xl font-semibold ${kpTone}`}>{kp?.toFixed(1) ?? "—"}</div>
      </div>
      <div className="rounded-lg border border-line bg-panel p-3">
        <div className="text-[11px] uppercase tracking-wide text-ink-dim">Geomagnetic state</div>
        <div className={`mt-1 text-sm ${kpTone}`}>
          {kp == null ? "—" : kp >= 7 ? "Strong storm" : kp >= 5 ? "Minor storm" : kp >= 4 ? "Active" : "Quiet"}
        </div>
      </div>
    </div>
  );
}

function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const btn = (id: Tab, label: string, icon: React.ReactNode) => (
    <button
      key={id}
      onClick={() => onTab(id)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        tab === id ? "border-violet-700 bg-violet-950/50 text-violet-300" : "border-line text-ink-dim hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {btn("intel", "Intelligence feed", <Satellite className="h-3.5 w-3.5" />)}
      {btn("orbit", "Orbit tracker", <Globe2 className="h-3.5 w-3.5" />)}
      {btn("solar", "Solar system", <Orbit className="h-3.5 w-3.5" />)}
    </div>
  );
}

export default function SpacePage() {
  const [tab, setTab] = useState<Tab>("intel");

  if (tab === "orbit") {
    return (
      <div>
        <h1 className="mb-1 text-lg font-semibold text-ink">Space</h1>
        <p className="mb-3 text-xs text-ink-dim">Live satellite positions from CelesTrak TLEs, propagated with SGP4</p>
        <TabBar tab={tab} onTab={setTab} />
        <LiveStats />
        <OrbitGlobe />
      </div>
    );
  }

  if (tab === "solar") {
    return (
      <div>
        <h1 className="mb-1 text-lg font-semibold text-ink">Space</h1>
        <p className="mb-3 text-xs text-ink-dim">Heliocentric planetary positions from JPL approximate elements</p>
        <TabBar tab={tab} onTab={setTab} />
        <SolarSystem />
      </div>
    );
  }

  return (
    <div>
      <TabBar tab={tab} onTab={setTab} />
      <ModuleView
        module="space"
        title="Space"
        subtitle="Launches (Launch Library 2), space weather (NOAA SWPC), new satellites (CelesTrak)"
        extraHeader={<LiveStats />}
        refreshSeconds={600}
      />
    </div>
  );
}
