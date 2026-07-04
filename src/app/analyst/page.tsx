"use client";

// AI Analyst — natural-language cross-module Q&A (PRD §17.14, Flow D).
// Retrieval-grounded: answers cite [n] sources which are clickable into the
// in-app reader. Query scope can be narrowed to specific modules first.

import { useRef, useState } from "react";
import { Bot, LoaderCircle, Send } from "lucide-react";
import type { Item } from "@/lib/types";
import { MODULES } from "@/lib/modules";
import { ReaderPane } from "@/components/ReaderPane";

interface Turn {
  question: string;
  answer?: string;
  sources?: Item[];
  error?: string;
}

const SCOPABLE = MODULES.filter((m) => !["graph", "analyst", "city", "earth"].includes(m.id));

const SUGGESTIONS = [
  "What are the most severe vulnerabilities disclosed this week?",
  "Summarize today's biggest global news stories",
  "Which platforms are having incidents right now?",
  "What rocket launches are coming up and who's launching?",
  "How are crypto markets moving today?",
];

export default function AnalystPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [openSource, setOpenSource] = useState<Item | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setQ("");
    setBusy(true);
    setTurns((t) => [...t, { question }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    try {
      const res = await fetch("/api/analyst", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, modules: scope }),
      });
      const d = await res.json();
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = { question, answer: d.answer, sources: d.sources, error: d.error };
        return next;
      });
    } catch (e) {
      setTurns((t) => {
        const next = [...t];
        next[next.length - 1] = { question, error: String(e) };
        return next;
      });
    } finally {
      setBusy(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const renderAnswer = (turn: Turn) => {
    if (!turn.answer) return null;
    // Make [n] citations clickable into the reader pane.
    const parts = turn.answer.split(/(\[\d+\])/g);
    return (
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-soft">
        {parts.map((p, i) => {
          const m = p.match(/^\[(\d+)\]$/);
          if (m && turn.sources) {
            const src = turn.sources[parseInt(m[1], 10) - 1];
            if (src) {
              return (
                <button key={i} onClick={() => setOpenSource(src)}
                  className="mx-0.5 rounded bg-purple-950/60 px-1 text-[11px] text-purple-300 hover:bg-purple-900/60"
                  title={src.title}>
                  {m[1]}
                </button>
              );
            }
          }
          return <span key={i}>{p}</span>;
        })}
      </p>
    );
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="flex h-[calc(100vh-8rem)] flex-col">
        <div className="mb-2">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Bot className="h-5 w-5 text-purple-400" /> AI Analyst
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-ink-dim">Scope:</span>
            <button onClick={() => setScope([])}
              className={`rounded-full border px-2 py-0.5 text-[11px] ${scope.length === 0 ? "border-purple-700 bg-purple-950/50 text-purple-300" : "border-line text-ink-dim"}`}>
              all modules
            </button>
            {SCOPABLE.map((m) => (
              <button key={m.id}
                onClick={() => setScope((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${scope.includes(m.id) ? "border-purple-700 bg-purple-950/50 text-purple-300" : "border-line text-ink-dim"}`}>
                {m.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border border-line bg-panel p-4">
          {turns.length === 0 && (
            <div className="text-sm text-ink-dim">
              <p className="mb-3">
                Ask a question across live public data. Answers are grounded in retrieved items and cite
                their sources — predictions are always labeled as AI hypotheses.
              </p>
              <div className="flex flex-col items-start gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => ask(s)}
                    className="rounded-md border border-line px-2.5 py-1.5 text-left text-xs text-ink-dim hover:border-purple-800 hover:text-purple-300">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {turns.map((t, i) => (
            <div key={i}>
              <div className="mb-1.5 ml-auto w-fit max-w-[85%] rounded-lg bg-panel-2 px-3 py-2 text-sm text-ink">{t.question}</div>
              {!t.answer && !t.error && (
                <div className="flex items-center gap-2 text-xs text-ink-dim">
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Retrieving sources and analyzing…
                </div>
              )}
              {t.error && (
                <div className="rounded-md border border-amber-900 bg-amber-950/40 px-3 py-2 text-xs text-amber-300">{t.error}</div>
              )}
              {renderAnswer(t)}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form className="mt-2 flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); ask(q); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. what cyber incidents this week affected shipping companies?"
            className="flex-1 rounded-lg border border-line bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-ink-dim focus:border-purple-700 focus:outline-none" />
          <button type="submit" disabled={busy}
            className="rounded-lg border border-purple-800 bg-purple-950/50 p-2.5 text-purple-300 hover:bg-purple-900/50 disabled:opacity-50"
            aria-label="Ask">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="hidden max-h-[calc(100vh-8rem)] lg:block">
        {openSource ? (
          <ReaderPane item={openSource} onClose={() => setOpenSource(null)} />
        ) : (
          <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-line p-4 text-center text-xs text-ink-dim">
            Click a citation number in any answer to open its source here.
          </div>
        )}
      </div>
    </div>
  );
}
