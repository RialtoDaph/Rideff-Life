// Ask Clopar and the Home briefing (README → Ask Clopar; Home briefing).
// The work is in lib/ask-server.ts, shared with Telegram.

import { askAnswer, type Turn } from "@/lib/ask-server";
import { authorize } from "@/lib/server-auth";

export const maxDuration = 120;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "Clopar is not set up yet." }, { status: 503 });
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;

  const body = (await req.json().catch(() => null)) as { mode?: string; question?: string; history?: Turn[]; scope?: string; locale?: string } | null;
  const r = await askAnswer(auth.sb, auth.userId, {
    mode: body?.mode === "briefing" ? "briefing" : "ask",
    question: body?.question,
    history: Array.isArray(body?.history) ? body.history : [],
    scope: body?.scope,
    locale: body?.locale,
  });
  if ("error" in r) return Response.json(r.code ? { error: r.error, code: r.code } : { error: r.error }, { status: r.status });
  return Response.json(r.answer);
}
