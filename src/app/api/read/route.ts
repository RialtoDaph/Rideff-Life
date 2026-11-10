// Reads a receipt photo, a PDF bank statement or a work roster with Claude
// (README → Bank import: PDF; Scan receipt; Shifts: Read roster). The work is in
// lib/ai-read-server.ts, shared with Telegram. Only signed-in members may call it.

import { readWithAi } from "@/lib/ai-read-server";
import { authorize } from "@/lib/server-auth";

export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel accepts request bodies up to 4.5 MB
const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return fail("Reading with AI is not set up yet.", 503);

  // 1. Who is asking? The person's own sign-in token, checked by Supabase.
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;

  // 2. The file.
  const form = await req.formData().catch(() => null);
  const kind = form?.get("kind");
  const file = form?.get("file");
  if ((kind !== "receipt" && kind !== "statement" && kind !== "roster") || !(file instanceof File)) return fail("No file was sent.", 400);
  if (file.size > MAX_BYTES) return fail("The file is larger than 4 MB.", 413);
  const today = String(form?.get("today") ?? "").match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? new Date().toISOString().slice(0, 10);

  // 3. Claude reads it.
  const { data: me } = kind === "roster" ? await auth.sb.from("members").select("display_name").eq("id", auth.userId).maybeSingle() : { data: null };
  const r = await readWithAi(auth.sb, kind, new Uint8Array(await file.arrayBuffer()), file.type, today, me?.display_name ?? undefined);
  if ("error" in r) return fail(r.error, r.status);
  return Response.json({ kind, result: r.result });
}
