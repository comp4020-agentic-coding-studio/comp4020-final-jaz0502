import type { Plot, PlotState } from "./types.ts";

export const GRID_SIZE = 25;

// Env-overridable so a demo can shorten a garden's rhythm without a code
// change. Defaults are a placeholder cadence, not a load-bearing design
// decision.
const SEED_TO_SPROUT_MS = Number(process.env.SEED_TO_SPROUT_MS ?? 3 * 60_000);
const SPROUT_TO_MATURE_MS = Number(process.env.SPROUT_TO_MATURE_MS ?? 7 * 60_000);
const WILT_WINDOW_MS = Number(process.env.WILT_WINDOW_MS ?? 18 * 60 * 60_000);

export function emptyPlot(position: number): Plot {
  return {
    position,
    state: "empty",
    plantedAt: null,
    plantedBy: null,
    lastWateredAt: null,
    lastWateredBy: null,
  };
}

// Pure: recomputes a plot's true state from its stored timestamps as of
// `now`. The stored `state` field is never trusted on its own for a
// planted/growing plot — only plantedAt/lastWateredAt are ground truth —
// so this stays correct even after a process restart or a cold start from
// zero, with no ticking timer required.
export function derivePlot(row: Plot, now: number): Plot {
  if (row.state === "empty") return row;
  if (row.plantedAt === null || row.lastWateredAt === null) return row;

  if (now - row.lastWateredAt > WILT_WINDOW_MS) {
    return { ...row, state: "wilted" };
  }

  const elapsed = now - row.plantedAt;
  let state: PlotState;
  if (elapsed >= SEED_TO_SPROUT_MS + SPROUT_TO_MATURE_MS) state = "mature";
  else if (elapsed >= SEED_TO_SPROUT_MS) state = "sprout";
  else state = "planted";

  return { ...row, state };
}
