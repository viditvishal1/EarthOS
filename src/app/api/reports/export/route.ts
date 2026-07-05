import { NextRequest, NextResponse } from "next/server";
import { groundedResearch } from "@/lib/research/grounded";
import { trackApiRequest } from "@/lib/usage/tracker";

export const dynamic = "force-dynamic";

interface EvidenceInput {
  title: string;
  url?: string;
  excerpt?: string;
  pinned_at?: string;
}

export async function POST(req: NextRequest) {
  await trackApiRequest("/api/reports/export");
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "Argus Investigation Report");
  const query = String(body.query ?? body.hypothesis ?? title).trim();
  const evidence = (Array.isArray(body.evidence) ? body.evidence : []) as EvidenceInput[];
  const notes = (Array.isArray(body.notes) ? body.notes : []) as { body: string; author?: string }[];

  const research = query ? await groundedResearch(query) : null;

  const lines = [
    `# ${title}`,
    "",
    `_Generated ${new Date().toISOString()}_`,
    "",
  ];

  if (research?.answer) {
    lines.push("## Research synthesis", "", research.answer, "", `**Confidence:** ${research.confidence}`, "");
    if (research.citations.length > 0) {
      lines.push("### Research citations", "");
      for (const c of research.citations) {
        lines.push(`${c.index}. **${c.title}** — ${c.publisher} (${c.observedAt})${c.url ? ` [link](${c.url})` : ""}`);
      }
      lines.push("");
    }
  }

  if (evidence.length > 0) {
    lines.push("## Pinned evidence", "");
    evidence.forEach((e, i) => {
      lines.push(`${i + 1}. **${e.title}**${e.url ? ` — [source](${e.url})` : ""}`);
      if (e.excerpt) lines.push(`   > ${e.excerpt}`);
      if (e.pinned_at) lines.push(`   _Pinned ${e.pinned_at}_`);
      lines.push("");
    });
  }

  if (notes.length > 0) {
    lines.push("## Analyst notes", "");
    for (const n of notes) {
      lines.push(`- ${n.body}${n.author ? ` _(${n.author})_` : ""}`);
    }
    lines.push("");
  }

  if (!research?.answer && evidence.length === 0 && notes.length === 0) {
    return NextResponse.json({ error: "query, evidence, or notes required" }, { status: 400 });
  }

  lines.push("---", research?.inferenceLabel ?? "Argus cited report export.");

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="argus-report-${Date.now()}.md"`,
    },
  });
}
