"use client";

// Global command palette — ⌘K / Ctrl+K. Jump to any module, or press Enter
// on free text to run a global search. Pure client-side, no data fetches.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command, CornerDownLeft, Search } from "lucide-react";
import { MODULES } from "@/lib/modules";

interface PaletteEntry {
  id: string;
  label: string;
  hint: string;
  path: string;
}

const STATIC_ENTRIES: PaletteEntry[] = [
  ...MODULES.map((m) => ({ id: m.id, label: m.name, hint: m.description, path: m.path })),
  { id: "saved", label: "Saved", hint: "Bookmarks and watchlists", path: "/saved" },
  { id: "sources", label: "Sources", hint: "Connector health and configuration", path: "/admin/sources" },
  { id: "settings", label: "Settings", hint: "Theme, keys, preferences", path: "/settings" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        setQ("");
        setCursor(0);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return STATIC_ENTRIES;
    return STATIC_ENTRIES.filter(
      (e) => e.label.toLowerCase().includes(needle) || e.hint.toLowerCase().includes(needle),
    );
  }, [q]);

  const go = useCallback(
    (entry?: PaletteEntry) => {
      setOpen(false);
      if (entry) router.push(entry.path);
      else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    },
    [router, q],
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px] text-ink-dim hover:text-ink md:flex"
        title="Command palette"
      >
        <Command className="h-3 w-3" /> K
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[11px] text-ink-dim hover:text-ink md:flex"
        title="Command palette"
      >
        <Command className="h-3 w-3" /> K
      </button>
      <div className="fixed inset-0 z-[100] bg-black/50 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
        <div
          className="mx-auto max-w-lg overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search className="h-4 w-4 shrink-0 text-ink-dim" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); setCursor(0); }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, matches.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
                if (e.key === "Enter") { e.preventDefault(); go(matches[cursor]); }
              }}
              placeholder="Jump to a module, or type to search everything…"
              className="w-full bg-transparent py-3 text-sm text-ink outline-none placeholder:text-ink-dim"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1.5">
            {matches.map((m, i) => (
              <button
                key={m.id}
                onClick={() => go(m)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left ${
                  i === cursor ? "bg-panel-2 text-ink" : "text-ink-dim"
                }`}
              >
                <span className="text-[13px] font-medium">{m.label}</span>
                <span className="truncate text-[11px]">{m.hint}</span>
              </button>
            ))}
            {q.trim() && (
              <button
                onClick={() => go()}
                onMouseEnter={() => setCursor(matches.length)}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] ${
                  cursor >= matches.length ? "bg-panel-2 text-ink" : "text-ink-dim"
                }`}
              >
                <CornerDownLeft className="h-3.5 w-3.5" />
                Search all modules for “{q.trim()}”
              </button>
            )}
            {matches.length === 0 && !q.trim() && (
              <div className="px-3 py-4 text-xs text-ink-dim">Nothing matches.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
