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
