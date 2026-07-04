"use client";

import { LoaderCircle } from "lucide-react";

export function PdfViewer({ url }: { url: string }) {
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-dim">PDF document</div>
      <iframe
        src={`${url}#view=FitH`}
        title="PDF document"
        className="h-[min(60vh,520px)] w-full rounded-md border border-line bg-panel-2"
      />
      <a href={url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline">
        Open PDF in new tab
      </a>
    </div>
  );
}

export function ArticleContent({
  state,
}: {
  state: {
    loading: boolean;
    paragraphs?: string[];
    pdfUrl?: string;
    contentType?: "html" | "pdf";
    cached?: boolean;
    error?: string;
    fetchedAt?: string;
  };
}) {
  if (state.loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-xs text-ink-dim">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading content…
      </div>
    );
  }
  if (state.contentType === "pdf" && state.pdfUrl) {
    return <PdfViewer url={state.pdfUrl} />;
  }
  if (state.error || !state.paragraphs?.length) {
    return (
      <p className="py-3 text-xs text-ink-dim">
        Full text couldn&apos;t be loaded ({state.error ?? "no text"}). Use the original link above.
      </p>
    );
  }
  return (
    <>
      {state.cached && (
        <p className="mt-2 text-[11px] text-ink-dim">
          Cached copy{state.fetchedAt ? ` · fetched ${new Date(state.fetchedAt).toLocaleString()}` : ""}
        </p>
      )}
      <div className="prose-earthos mt-2">
        {state.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </>
  );
}
