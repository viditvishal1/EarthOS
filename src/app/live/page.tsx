"use client";

// Live Channels — broadcaster live news TV and operator-published public city
// webcams. Officially public streams only (never unsecured/private cameras).
// Streams lazy-load: a thumbnail renders until the user activates the player,
// and at most four players run at once to keep CPU/bandwidth sane.

import { useMemo, useState } from "react";
import { ExternalLink, Play, X } from "lucide-react";
import {
  LIVE_CATEGORIES, LIVE_CHANNELS, type LiveCategory, type LiveChannel,
} from "@/lib/config/live-channels";

const MAX_ACTIVE = 4;

function ChannelCard({
  ch, active, focused, onToggle, onFocus,
}: {
  ch: LiveChannel;
  active: boolean;
  focused: boolean;
  onToggle: () => void;
  onFocus: () => void;
}) {
  return (
    <div className={`overflow-hidden rounded-lg border bg-panel ${focused ? "border-accent/60" : "border-line"}`}>
      <div className="relative aspect-video w-full bg-black">
        {active ? (
          <iframe
            title={ch.name}
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${ch.videoId}?autoplay=1&mute=1&playsinline=1`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button onClick={onToggle} className="group absolute inset-0" aria-label={`Play ${ch.name}`}>
            {/* YouTube thumbnail as poster — no player cost until activated */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${ch.videoId}/hqdefault.jpg`}
              alt={ch.name}
              className="h-full w-full object-cover opacity-75 transition-opacity group-hover:opacity-100"
              loading="lazy"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/60 p-3 transition-transform group-hover:scale-110">
                <Play className="h-5 w-5 text-white" />
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 px-2.5 py-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-ink">
            {ch.name}{ch.place ? ` · ${ch.place}` : ""}
          </div>
          <div className="truncate text-[11px] text-ink-dim">{ch.provider} · official public stream</div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {active && (
            <>
              <button onClick={onFocus} className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-dim hover:text-ink">
                {focused ? "Unfocus" : "Focus"}
              </button>
              <button onClick={onToggle} className="rounded border border-line p-1 text-ink-dim hover:text-ink" aria-label="Stop">
                <X className="h-3 w-3" />
              </button>
            </>
          )}
          <a
            href={ch.channelUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded border border-line p-1 text-ink-dim hover:text-ink"
            title="Open channel (fallback if the stream ID rotated)"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function LiveChannelsPage() {
  const [category, setCategory] = useState<LiveCategory | "all">("all");
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);

  const channels = useMemo(
    () => LIVE_CHANNELS.filter((c) => category === "all" || c.category === category),
    [category],
  );

  const toggle = (id: string) => {
    setActiveIds((prev) => {
      if (prev.includes(id)) {
        if (focusId === id) setFocusId(null);
        return prev.filter((x) => x !== id);
      }
      // Oldest stream stops when a fifth starts.
      return [...prev, id].slice(-MAX_ACTIVE);
    });
  };

  const focused = focusId ? channels.find((c) => c.id === focusId) : null;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-3">
        <h1 className="text-lg font-semibold text-ink">Live Channels</h1>
        <p className="text-xs text-ink-dim">
          Broadcaster live TV + operator-published public webcams · up to {MAX_ACTIVE} players at once ·
          stream IDs rotate — use the ↗ channel link if a tile is stale
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {LIVE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              category === c.id ? "border-pink-600 bg-pink-950/40 text-pink-300" : "border-line text-ink-dim hover:text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-ink-dim">
          {channels.length} channels · {activeIds.length} playing
        </span>
      </div>

      {focused && (
        <div className="mb-4">
          <ChannelCard
            ch={focused}
            active={activeIds.includes(focused.id)}
            focused
            onToggle={() => toggle(focused.id)}
            onFocus={() => setFocusId(null)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {channels.filter((c) => c.id !== focusId).map((ch) => (
          <ChannelCard
            key={ch.id}
            ch={ch}
            active={activeIds.includes(ch.id)}
            focused={false}
            onToggle={() => toggle(ch.id)}
            onFocus={() => setFocusId(ch.id)}
          />
        ))}
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-dim">
        Every feed here is an officially published public stream (broadcaster live channels, NASA TV, and
        operator-run city webcams embedded via YouTube&apos;s player). Argus never aggregates unsecured or
        private cameras. Playback is subject to each operator&apos;s terms; embeds use youtube-nocookie.com.
      </p>
    </div>
  );
}
