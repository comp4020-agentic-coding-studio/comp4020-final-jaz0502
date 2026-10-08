// Who is in the garden right now, and where their figure is on the path round
// the bed. Held in memory only: nothing here is stored, and it starts empty
// after a restart, which is fine because a stopped machine has nobody on it.
// A gardener is the cookie, as everywhere else, so two tabs in one browser are
// one gardener with one figure; everything here is keyed by the public id and
// the cookie itself never comes in.

export interface Gardener {
  id: string;
  // Where the figure is, and where it is walking to, as a fraction round the
  // loop: 0 <= x < 1. The server never needs to know the loop's shape.
  u: number;
  target: number;
}

interface Entry extends Gardener {
  connections: number;
  lastMoveAt: number;
}

// One browser asking to move more than this often is dropped, and the table is
// capped, so a stranger cannot flood a small machine with figures or messages.
export const MIN_MOVE_GAP_MS = 100;
const MAX_GARDENERS = 200;

const gardeners = new Map<string, Entry>();

// Newcomers start spread round the loop instead of stacked on one spot.
function spawnPoint(id: string): number {
  return parseInt(id.slice(0, 4), 16) / 0x10000;
}

function isPosition(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1;
}

export function listGardeners(): Gardener[] {
  return [...gardeners.values()].map(({ id, u, target }) => ({ id, u, target }));
}

// A connection opened. Returns the gardener if this is their first, so the
// others can be told they have arrived; null if they were already here (another
// tab) or the garden is full.
export function connect(id: string): Gardener | null {
  const existing = gardeners.get(id);
  if (existing) {
    existing.connections++;
    return null;
  }
  if (gardeners.size >= MAX_GARDENERS) return null;

  const u = spawnPoint(id);
  gardeners.set(id, { id, u, target: u, connections: 1, lastMoveAt: 0 });
  return { id, u, target: u };
}

// A connection closed. True if it was their last, so they have left.
export function disconnect(id: string): boolean {
  const entry = gardeners.get(id);
  if (!entry) return false;
  entry.connections--;
  if (entry.connections > 0) return false;
  gardeners.delete(id);
  return true;
}

export type MoveResult =
  | { ok: true; gardener: Gardener }
  | { ok: false; reason: "invalid" | "not-connected" | "too-fast" };

// A gardener says where their figure is and where it is going. Checked in the
// order a caller would want to hear about: a malformed message first, then not
// being here at all, then being too quick.
export function move(id: string, body: unknown, now: number): MoveResult {
  if (typeof body !== "object" || body === null) return { ok: false, reason: "invalid" };
  const { u, target } = body as { u?: unknown; target?: unknown };
  if (!isPosition(u) || !isPosition(target)) return { ok: false, reason: "invalid" };

  const entry = gardeners.get(id);
  if (!entry) return { ok: false, reason: "not-connected" };
  if (now - entry.lastMoveAt < MIN_MOVE_GAP_MS) return { ok: false, reason: "too-fast" };

  entry.u = u;
  entry.target = target;
  entry.lastMoveAt = now;
  return { ok: true, gardener: { id, u, target } };
}
