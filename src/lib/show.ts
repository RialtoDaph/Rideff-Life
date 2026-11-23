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

// The names of the items on the map, so "show me the emergency fund" can point at one. The index is
// filled by the scene host; what comes out is always a node id from it, never text from the model.
type Indexed = { id: string; label: string; kind: string };
let index: Indexed[] = [];
export const setShowIndex = (nodes: Indexed[]) => {
  index = nodes.filter((n) => n.kind !== "core" && n.kind !== "hub");
};
export const isShowNode = (id: string) => index.some((n) => n.id === id);
export const showLabel = (id: string) => index.find((n) => n.id === id)?.label ?? null;
export const norm = (x: string) =>
  x
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** One item on the map by its name: exact beats starts-with beats contains, and only a single best match counts. */
export function matchNode(name: string): string | null {
  const q = norm(name);
  if (!q) return null;
  for (const test of [(l: string) => l === q, (l: string) => l.startsWith(q), (l: string) => l.includes(q)]) {
    const hits = index.filter((n) => test(norm(n.label)));
    if (hits.length === 1) return hits[0].id;
    if (hits.length > 1) return null;
  }
  return null;
}

/** Where a `show` call points: an area or screen as before, else one item on the map by name. */
export function resolveShow(args: string): ShowTarget | null {
  const place = parseShow(args);
  if (place) return place;
  try {
    const target = (JSON.parse(args) as { target?: unknown }).target;
    return typeof target === "string" ? matchNode(target) : null;
  } catch {
    return null;
  }
}

const READS: Record<string, string> = { get_budget: "money", get_net_worth: "money", get_week: "time", get_goals: "goals", simulate: "goals", get_subscriptions: "money" };
export const hubForTool = (name: string): string | null => READS[name] ?? null;

export const dispatchShow = (target: ShowTarget) => window.dispatchEvent(new CustomEvent(SHOW_EVENT, { detail: { target } }));

/** The tool the realtime session is given on top of the data tools. It is run by the app, not the server. */
export const SHOW_TOOL = {
  type: "function",
  name: "show",
  description: `Move the app's view to what you are talking about: an area (${MODULE_ORDER.map((k) => `${k} = ${MODULES[k].name}`).join(", ")}), "core" for the whole picture, or a screen id such as budget, debts, week, gym, ygoals, or the name of one item on the map (a goal, an account). Call it whenever you start talking about one place.`,
  parameters: { type: "object", additionalProperties: false, properties: { target: { type: "string" } }, required: ["target"] },
};
