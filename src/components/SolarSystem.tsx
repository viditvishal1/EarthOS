"use client";

// Solar-system tracker — real planetary positions computed from the JPL
// approximate Keplerian elements (J2000 + centennial rates), drawn top-down
// (north ecliptic pole) with distance-compressed orbits so Mercury and
// Neptune fit one canvas. Time is scrubbable like NASA's "Eyes".

import { useEffect, useRef, useState } from "react";

// [a AU, e, I°, L°, ϖ°, Ω°] and per-Julian-century rates. Source: JPL SSD.
const ELEMENTS: {
  name: string; color: string; rKm: number;
  el: [number, number, number, number, number, number];
  rate: [number, number, number, number, number, number];
}[] = [
  { name: "Mercury", color: "#b3aca4", rKm: 2440, el: [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  { name: "Venus", color: "#e6c87d", rKm: 6052, el: [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], rate: [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418] },
  { name: "Earth", color: "#6fa8dc", rKm: 6371, el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0] },
  { name: "Mars", color: "#d97757", rKm: 3390, el: [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  { name: "Jupiter", color: "#d9b38c", rKm: 69911, el: [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  { name: "Saturn", color: "#e8d9a0", rKm: 58232, el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], rate: [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  { name: "Uranus", color: "#9fd8d8", rKm: 25362, el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  { name: "Neptune", color: "#7a9fe6", rKm: 24622, el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
];

const D2R = Math.PI / 180;

/** Heliocentric ecliptic x/y (AU) at a given date. */
function planetXY(p: (typeof ELEMENTS)[number], date: Date): { x: number; y: number; rAU: number } {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525;
  const [a0, e0, I0, L0, w0, O0] = p.el;
  const [ar, er, Ir, Lr, wr, Or] = p.rate;
  const a = a0 + ar * T, e = e0 + er * T;
  const I = (I0 + Ir * T) * D2R;
  const L = (L0 + Lr * T) * D2R;
  const wBar = (w0 + wr * T) * D2R;
  const O = (O0 + Or * T) * D2R;
  const M = L - wBar;
  const w = wBar - O;
  // Kepler: E - e·sinE = M  (Newton, 6 iterations is plenty at these e)
  let E = M;
  for (let i = 0; i < 6; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const x =
    (Math.cos(w) * Math.cos(O) - Math.sin(w) * Math.sin(O) * Math.cos(I)) * xp +
    (-Math.sin(w) * Math.cos(O) - Math.cos(w) * Math.sin(O) * Math.cos(I)) * yp;
  const y =
    (Math.cos(w) * Math.sin(O) + Math.sin(w) * Math.cos(O) * Math.cos(I)) * xp +
    (-Math.sin(w) * Math.sin(O) + Math.cos(w) * Math.cos(O) * Math.cos(I)) * yp;
  return { x, y, rAU: Math.sqrt(x * x + y * y) };
}

const SPEEDS = [
  { label: "Real time", daysPerSec: 1 / 86400 },
  { label: "1 day/s", daysPerSec: 1 },
  { label: "1 week/s", daysPerSec: 7 },
  { label: "1 month/s", daysPerSec: 30 },
  { label: "1 year/s", daysPerSec: 365 },
];

export function SolarSystem() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [simDate, setSimDate] = useState(() => new Date());
  const simRef = useRef(simDate.getTime());
  const speedRef = useRef(SPEEDS[1].daysPerSec);
  speedRef.current = SPEEDS[speedIdx].daysPerSec;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    const cx = W / 2, cy = H / 2;
    const maxR = Math.min(W, H) / 2 - 28;
    // Compress 0.39→30 AU into the canvas: r ∝ AU^0.42
    const scale = (au: number) => maxR * Math.pow(au / 30.1, 0.42);

    let last = performance.now();
    let raf = 0;
    const isLight = document.documentElement.getAttribute("data-theme") === "light";

    const draw = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      simRef.current += speedRef.current * 86400000 * dt;
      const date = new Date(simRef.current);
      if (Math.abs(date.getTime() - simDate.getTime()) > 43200000) setSimDate(date);

      ctx.clearRect(0, 0, W, H);
      // Sun
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#f9a825";
      ctx.shadowColor = "#f9a825";
      ctx.shadowBlur = 18;
      ctx.fill();
      ctx.shadowBlur = 0;

      for (const p of ELEMENTS) {
        // Orbit path (sampled over one revolution at the current epoch)
        ctx.beginPath();
        ctx.strokeStyle = isLight ? "rgba(30,32,51,0.18)" : "rgba(139,152,165,0.25)";
        ctx.lineWidth = 1;
        const periodDays = 365.25 * Math.pow(p.el[0], 1.5);
        for (let i = 0; i <= 128; i++) {
          const d = new Date(simRef.current + (i / 128) * periodDays * 86400000);
          const pos = planetXY(p, d);
          const r = scale(pos.rAU);
          const px = cx + (pos.x / pos.rAU) * r;
          const py = cy - (pos.y / pos.rAU) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();

        const pos = planetXY(p, date);
        const r = scale(pos.rAU);
        const px = cx + (pos.x / pos.rAU) * r;
        const py = cy - (pos.y / pos.rAU) * r;
        const size = Math.max(2.5, Math.min(9, Math.log10(p.rKm) * 2 - 4));
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.fillStyle = isLight ? "#3a3f5c" : "#8b98a5";
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillText(`${p.name} ${pos.rAU.toFixed(2)} AU`, px + size + 4, py + 3);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speedIdx]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {SPEEDS.map((s, i) => (
          <button key={s.label} onClick={() => setSpeedIdx(i)}
            className={`rounded-full border px-2.5 py-1 text-xs ${i === speedIdx ? "border-violet-700 bg-violet-950/50 text-violet-300" : "border-line text-ink-dim hover:text-ink"}`}>
            {s.label}
          </button>
        ))}
        <button
          onClick={() => { simRef.current = Date.now(); setSimDate(new Date()); }}
          className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-dim hover:text-ink"
        >
          Now
        </button>
        <span className="mono ml-auto text-xs text-ink">{simDate.toUTCString().slice(0, 16)}</span>
      </div>
      <canvas ref={canvasRef} className="h-[62vh] w-full rounded-lg border border-line bg-panel" role="img"
        aria-label="Top-down solar system view with live planetary positions" />
      <p className="mt-1.5 text-[11px] text-ink-dim">
        Positions from JPL approximate Keplerian elements (heliocentric, top-down on the ecliptic).
        Orbit radii are distance-compressed so all eight planets fit one view.
      </p>
    </div>
  );
}
