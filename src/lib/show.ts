// "Show me": the assistant points at a place in the app. A reading tool points at its area
// by itself; the `show` tool does it on purpose. The scene flies there, or the app opens
// the screen. All of it happens in the browser: nothing here touches data.

import { MODULE_ORDER, MODULES, screenInfo } from "./nav";

export const SHOW_EVENT = "rideff:show";
export type ShowTarget = string;

const AREAS = new Set<string>(["core", ...MODULE_ORDER]);

/** The target of a `show` call, if it is the core, an area or a screen of the app. */
export function parseShow(args: string): ShowTarget | null {
  try {
    const target = (JSON.parse(args) as { target?: unknown }).target;
    if (typeof target !== "string") return null;
    return AREAS.has(target) || screenInfo(target) ? target : null;
  } catch {
    return null;
  }
}

const READS: Record<string, string> = { get_budget: "money", get_net_worth: "money", get_week: "time", get_goals: "goals", simulate: "goals" };
export const hubForTool = (name: string): string | null => READS[name] ?? null;

export const dispatchShow = (target: ShowTarget) => window.dispatchEvent(new CustomEvent(SHOW_EVENT, { detail: { target } }));

/** The tool the realtime session is given on top of the data tools. It is run by the app, not the server. */
export const SHOW_TOOL = {
  type: "function",
  name: "show",
  description: `Move the app's view to what you are talking about: an area (${MODULE_ORDER.map((k) => `${k} = ${MODULES[k].name}`).join(", ")}), "core" for the whole picture, or a screen id such as budget, debts, week, gym, ygoals. Call it whenever you start talking about one place.`,
  parameters: { type: "object", additionalProperties: false, properties: { target: { type: "string" } }, required: ["target"] },
};
