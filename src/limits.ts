// How often one gardener may act on a plot: a budget of actions in a window of
// time. A stranger's browser is a source of messages, so this is checked on the
// server, and it counts every attempt, refused ones too, because hammering a plot
// you can't act on is the same flood. Held in memory only, keyed by the public
// id, so the cookie never comes in; it starts empty after a restart.
//
// A budget rather than a fixed gap, so planting a quick row is fine but a script
// looping over every plot is stopped after a handful.

// Env-overridable so specs can use a small budget and a short window.
const ACTION_LIMIT = Number(process.env.ACTION_LIMIT ?? 15);
const ACTION_WINDOW_MS = Number(process.env.ACTION_WINDOW_MS ?? 10_000);
// Past this many people in the table, the oldest windows are dropped, so a
// stranger minting cookies cannot grow it without limit.
const MAX_TRACKED = 5000;

interface Window {
  start: number;
  count: number;
  // Whether this window's refusal has been reported (logged) already.
  reported: boolean;
}

const windows = new Map<string, Window>();

// When refused, how long until the window ends and the person can act again, so
// the page can wait instead of sending clicks it knows will be turned away.
export type ActionResult = { ok: true } | { ok: false; firstRefusal: boolean; retryAfterMs: number };

export function allowAction(id: string, now: number): ActionResult {
  let entry = windows.get(id);
  if (!entry || now - entry.start >= ACTION_WINDOW_MS) {
    if (!entry && windows.size >= MAX_TRACKED) dropExpired(now);
    // A fresh window. Re-inserting keeps the map in order of when windows began.
    windows.delete(id);
    entry = { start: now, count: 0, reported: false };
    windows.set(id, entry);
  }

  entry.count++;
  if (entry.count <= ACTION_LIMIT) return { ok: true };

  const firstRefusal = !entry.reported;
  entry.reported = true;
  return { ok: false, firstRefusal, retryAfterMs: Math.max(0, entry.start + ACTION_WINDOW_MS - now) };
}

// Forget everyone whose window has ended, and if that is not enough, the oldest.
function dropExpired(now: number): void {
  for (const [id, entry] of windows) {
    if (now - entry.start >= ACTION_WINDOW_MS) windows.delete(id);
  }
  while (windows.size >= MAX_TRACKED) {
    const oldest = windows.keys().next().value;
    if (oldest === undefined) break;
    windows.delete(oldest);
  }
}

// How much one gardener may plant in the shared garden: so many plantings in any
// hour, and only so many of those in one bed, so nobody takes over a bed or the
// whole garden. It counts plantings that succeeded, because a refused one planted
// nothing; the limit above already stops anyone hammering. It is a rolling hour, so
// the allowance comes back a little at a time rather than all at once, and nobody is
// locked out for long. Like the action limit it is kept in memory by public id, so the
// cookie never comes in, and it starts empty after a restart. It is only about the
// shared garden: your own garden is yours and is limited by your seeds.
const PLANT_LIMIT = Number(process.env.PLANT_LIMIT ?? 8);
const PLANT_BED_LIMIT = Number(process.env.PLANT_BED_LIMIT ?? 5);
const PLANT_WINDOW_MS = Number(process.env.PLANT_WINDOW_MS ?? 60 * 60_000);

const plantings = new Map<string, { at: number; bed: number }[]>();

export type PlantingResult =
  | { ok: true }
  | { ok: false; reason: "plant-limit" | "bed-limit"; retryAfterMs: number };

function recentPlantings(id: string, now: number): { at: number; bed: number }[] {
  const kept = (plantings.get(id) ?? []).filter((p) => now - p.at < PLANT_WINDOW_MS);
  if (kept.length > 0) plantings.set(id, kept);
  else plantings.delete(id);
  return kept;
}

// Whether this gardener may plant in this bed now, and if not, how long until they
// may. Does not count anything: call recordPlanting once it has worked.
export function mayPlant(id: string, bed: number, now: number): PlantingResult {
  const recent = recentPlantings(id, now);
  const inBed = recent.filter((p) => p.bed === bed);
  // The allowance comes back when the oldest planting that is in the way ages out.
  if (inBed.length >= PLANT_BED_LIMIT) {
    return { ok: false, reason: "bed-limit", retryAfterMs: inBed[inBed.length - PLANT_BED_LIMIT].at + PLANT_WINDOW_MS - now };
  }
  if (recent.length >= PLANT_LIMIT) {
    return { ok: false, reason: "plant-limit", retryAfterMs: recent[recent.length - PLANT_LIMIT].at + PLANT_WINDOW_MS - now };
  }
  return { ok: true };
}

export function recordPlanting(id: string, bed: number, now: number): void {
  // Past this many people in the table, the oldest are dropped, so a stranger minting
  // cookies cannot grow it without limit.
  if (!plantings.has(id) && plantings.size >= MAX_TRACKED) {
    const oldest = plantings.keys().next().value;
    if (oldest !== undefined) plantings.delete(oldest);
  }
  plantings.set(id, [...recentPlantings(id, now), { at: now, bed }]);
}
