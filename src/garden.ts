import type { PlantType, Plot, PlotState } from "./types.ts";

export const GRID_SIZE = 25;

export const PLANT_TYPES = ["tree", "flower", "shrub"] as const;

export function isPlantType(value: unknown): value is PlantType {
  return typeof value === "string" && (PLANT_TYPES as readonly string[]).includes(value);
}

// Env-overridable so a demo can shorten a garden's rhythm without a code
// change. These are the tree's durations; the other plants scale from them, so
// a short demo timing shortens every type. Defaults are a placeholder cadence,
// not a load-bearing design decision.
const SEED_TO_SPROUT_MS = Number(process.env.SEED_TO_SPROUT_MS ?? 3 * 60_000);
const SPROUT_TO_GROWING_MS = Number(process.env.SPROUT_TO_GROWING_MS ?? 7 * 60_000);
const GROWING_TO_MATURE_MS = Number(process.env.GROWING_TO_MATURE_MS ?? 10 * 60_000);

// Wilting is a rule of the garden, not of any one plant: every type wilts
// after the same time without water.
export const WILT_WINDOW_MS = Number(process.env.WILT_WINDOW_MS ?? 18 * 60 * 60_000);

// How fast each type moves through its stages, as a multiple of the tree's
// durations: a flower blooms in about half the time a tree takes to fruit.
const GROWTH_SCALE: Record<PlantType, number> = { tree: 1, flower: 0.5, shrub: 0.75 };

export function emptyPlot(position: number): Plot {
  return {
    position,
    state: "empty",
    plantType: null,
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

  const scale = GROWTH_SCALE[row.plantType ?? "tree"];
  const sproutAt = SEED_TO_SPROUT_MS * scale;
  const growingAt = sproutAt + SPROUT_TO_GROWING_MS * scale;
  const matureAt = growingAt + GROWING_TO_MATURE_MS * scale;

  const elapsed = now - row.plantedAt;
  let state: PlotState;
  if (elapsed >= matureAt) state = "mature";
  else if (elapsed >= growingAt) state = "growing";
  else if (elapsed >= sproutAt) state = "sprout";
  else state = "planted";

  return { ...row, state };
}
