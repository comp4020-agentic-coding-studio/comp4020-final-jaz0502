import type { PlantType, Plot, PlotState } from "./types.ts";

// Four beds of 25: plots 0 to 24 are the first bed, 25 to 49 the second, 50 to 74
// the third and 75 to 99 the fourth. Beds were added in that order, so each bed's
// plots keep their numbers.
export const GRID_SIZE = 100;

export const PLANT_TYPES = ["tree", "flower", "sunflower", "shrub", "vegetable"] as const;

// What each bed is called and what it takes, in the order of the plots. A bed with
// `takes: null` takes any plant. This is the one place that says so: the server
// enforces it, and the page reads it from the opening `hello` and only follows.
// Only planting is restricted: anyone may water or compost in any bed.
export interface Bed {
  name: string;
  takes: readonly PlantType[] | null;
  // The same in words, for the message when a plant is turned away.
  takesText: string;
}

export const BEDS: readonly Bed[] = [
  { name: "The Cottage Garden", takes: null, takesText: "any plant" },
  { name: "The Flower Garden", takes: ["flower", "sunflower", "shrub"], takesText: "tulips, sunflowers and flower shrubs" },
  { name: "The Fruit Garden", takes: ["tree"], takesText: "fruit trees" },
  { name: "The Vegetable Garden", takes: ["vegetable"], takesText: "vegetables" },
];

const BED_PLOTS = GRID_SIZE / BEDS.length;

// The bed a plot is in, or undefined for a position that is not a plot at all.
export function bedAt(position: number): Bed | undefined {
  if (!Number.isInteger(position) || position < 0 || position >= GRID_SIZE) return undefined;
  return BEDS[Math.floor(position / BED_PLOTS)];
}

export function bedTakes(bed: Bed, plantType: PlantType): boolean {
  return bed.takes === null || bed.takes.includes(plantType);
}

export function isPlantType(value: unknown): value is PlantType {
  return typeof value === "string" && (PLANT_TYPES as readonly string[]).includes(value);
}

// Env-overridable so a demo can shorten a garden's rhythm without a code
// change. These are the tree's durations; the other plants scale from them, so
// a short demo timing shortens every type. Defaults are a placeholder cadence,
// not a load-bearing design decision.
const SEED_TO_SPROUT_MS = Number(process.env.SEED_TO_SPROUT_MS ?? 9 * 60_000);
const SPROUT_TO_GROWING_MS = Number(process.env.SPROUT_TO_GROWING_MS ?? 21 * 60_000);
const GROWING_TO_MATURE_MS = Number(process.env.GROWING_TO_MATURE_MS ?? 30 * 60_000);

// Wilting is a rule of the garden, not of any one plant: every type wilts
// after the same time without water.
export const WILT_WINDOW_MS = Number(process.env.WILT_WINDOW_MS ?? 18 * 60 * 60_000);

// One day and night in the garden's sky: slow and calm, but short enough that
// a visit still catches a sunset or a night. Run on the server's clock so
// everyone shares the same sky.
export const DAY_LENGTH_MS = Number(process.env.DAY_LENGTH_MS ?? 30 * 60_000);

// How fast each type moves through its stages, as a multiple of the tree's
// durations: a tulip (stored as `flower`) blooms in about half the time a tree takes to fruit.
const GROWTH_SCALE: Record<PlantType, number> = { tree: 1, flower: 0.5, sunflower: 0.7, shrub: 0.75, vegetable: 0.6 };

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
