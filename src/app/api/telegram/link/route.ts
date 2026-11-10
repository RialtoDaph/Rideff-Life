// Settings → Telegram → Connect. For a signed-in member: points the bot at this
// app (webhook and reminders), then makes a one-time code and returns the t.me link
// that opens the bot with it. Doing the setup here means nobody has to run anything.

import { authorize } from "@/lib/server-auth";
import { derivedSecret, telegramReady, tg } from "@/lib/telegram/api";
import { tgAdmin } from "@/lib/telegram/session";

const fail = (code: string, status: number) => Response.json({ code }, { status });

export async function POST(req: Request) {
  if (!telegramReady()) return fail("no_token", 503);
  const admin = tgAdmin();
  if (!admin) return fail("no_server_key", 503);
  const auth = await authorize(req);
  if (auth instanceof Response) return auth;

  const bot = await tg<{ username?: string }>("getMe", {});
  if (!bot?.username) return fail("bad_token", 502);

  const origin = new URL(req.url).origin;
  const hooked = await tg("setWebhook", {
    url: `${origin}/api/telegram`,
    secret_token: derivedSecret("webhook"),
    allowed_updates: ["message", "callback_query"],
  });
  if (!hooked) return fail("webhook", 502);
  await tg("setMyCommands", { commands: [{ command: "help", description: "What Clopar can do" }] });

  const { error: cfgError } = await admin.rpc("telegram_config_set", { p_url: `${origin}/api/telegram/notify`, p_secret: derivedSecret("notify") });
  if (cfgError) {
    console.error("telegram_config_set", cfgError.message);
    return fail("failed", 502);
  }

  const { data: code, error } = await auth.sb.rpc("telegram_link_create");
  if (error || typeof code !== "string") {
    console.error("telegram_link_create", error?.message);
    return fail("failed", 502);
  }
  return Response.json({ url: `https://t.me/${bot.username}?start=${code}`, bot: bot.username });
}
