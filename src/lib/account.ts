// Who takes over a household when its owner deletes their account.

export type Heir = { id: string; role: string; sort: number };

/** The partner who joined first, else the member who joined first; null when nobody is left. */
export function successor<T extends Heir>(others: T[]): T | null {
  const byJoin = [...others].sort((a, b) => a.sort - b.sort);
  return byJoin.find((m) => m.role === "partner") ?? byJoin[0] ?? null;
}
