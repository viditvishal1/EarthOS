"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe2, Newspaper, ShieldAlert, Plane, Ship, Rocket, CandlestickChart,
  GitBranch, Landmark, Server, Building2, Network, Bot, Bookmark, Settings,
  Radar, FolderOpen, Flame, Tv, TrendingUp,
} from "lucide-react";
import { MODULES } from "@/lib/modules";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  earth: Globe2, news: Newspaper, cyber: ShieldAlert, aviation: Plane,
  maritime: Ship, space: Rocket, markets: CandlestickChart, startup: GitBranch,
  government: Landmark, infrastructure: Server, city: Building2,
  graph: Network, analyst: Bot, investigations: FolderOpen,
  conflict: Flame, live: Tv, macro: TrendingUp,
};

export function Nav() {
  const pathname = usePathname();
  const link = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const active = pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
          active
            ? "bg-panel-2 text-ink"
            : "text-ink-dim hover:bg-panel hover:text-ink"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="hidden lg:inline">{label}</span>
      </Link>
    );
  };

  return (
    <aside className="sticky top-0 flex h-screen w-12 shrink-0 flex-col border-r border-line bg-panel px-1.5 py-3 lg:w-56 lg:px-3">
      <Link href="/" className="mb-4 flex items-center gap-2 px-2">
        <Radar className="h-5 w-5 text-accent" />
        <span className="mono hidden text-sm font-semibold tracking-widest text-ink lg:inline">
          ARG<span className="text-accent">US</span>
        </span>
      </Link>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {MODULES.map((m) => link(m.path, m.name, ICONS[m.id] ?? Globe2))}
      </nav>
      <div className="mt-2 flex flex-col gap-0.5 border-t border-line pt-2">
        {link("/saved", "Saved", Bookmark)}
        {link("/admin/sources", "Sources", Settings)}
        {link("/settings", "Settings", Settings)}
      </div>
    </aside>
  );
}
