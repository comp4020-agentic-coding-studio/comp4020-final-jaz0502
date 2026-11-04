// Decorations for your own garden, unlocked by looking after the shared one. The list
// is fixed and in a fixed order, so nobody chooses what to chase: each one has a task. They are private to the gardener, like
// their seeds and their record, and are never compared, ranked or taken back.

export interface Decoration {
  id: string;
  name: string;
  // A fence replaces the hedge ring round your bed; a prop stands at one of a few
  // fixed spots beside it.
  kind: "fence" | "prop";
}

// In the order they are unlocked.
export const DECORATIONS: readonly Decoration[] = [
  { id: "bench", name: "Bench", kind: "prop" },
  { id: "picket", name: "Picket fence", kind: "fence" },
  { id: "lantern", name: "Lantern", kind: "prop" },
  { id: "scarecrow", name: "Scarecrow", kind: "prop" },
  { id: "rustic", name: "Rustic fence", kind: "fence" },
  { id: "gnome", name: "Garden gnome", kind: "prop" },
  { id: "birdbath", name: "Birdbath", kind: "prop" },
  { id: "stone", name: "Stone wall", kind: "fence" },
];

// Where a decoration can go: one spot for a fence, and a few for props.
// One for each prop, so all five can stand at once. The page draws a place for each
// (OWN_PROP_SPOTS in public/app.js), so the two stay the same length.
export const PROP_SPOTS = 5;
export const SPOTS: readonly string[] = ["fence", ...Array.from({ length: PROP_SPOTS }, (_, i) => `prop-${i}`)];

// What it takes to unlock each decoration, in the same fixed order: one task each, the same
// for everyone, so nobody chooses an order to chase. Only one task is shown at a time, and
// only how many more of it are left. A decoration, once unlocked, is never taken back.
export type TaskKind = "water" | "feed-cow" | "pat-hen" | "plant" | "gather" | "compost";
export const TASK_KINDS: readonly TaskKind[] = ["water", "feed-cow", "pat-hen", "plant", "gather", "compost"];

export interface Task {
  kind: TaskKind;
  count: number;
}

const DEFAULT_TASKS: readonly Task[] = [
  { kind: "water", count: 5 }, // bench
  { kind: "feed-cow", count: 3 }, // picket fence
  { kind: "pat-hen", count: 4 }, // lantern
  { kind: "plant", count: 5 }, // scarecrow
  { kind: "gather", count: 3 }, // rustic fence
  { kind: "water", count: 8 }, // gnome
  { kind: "feed-cow", count: 5 }, // birdbath
  { kind: "pat-hen", count: 6 }, // stone wall
];

// Env-overridable so specs and a quick look can use a small number: DECORATION_EVERY makes
// every task that many, and DECORATION_TASKS (a comma list of kinds) sets the kinds, used
// round in turn.
const EVERY = process.env.DECORATION_EVERY === undefined ? null : Number(process.env.DECORATION_EVERY);
const KINDS = (process.env.DECORATION_TASKS ?? "")
  .split(",")
  .filter((k): k is TaskKind => (TASK_KINDS as readonly string[]).includes(k));

export const TASKS: readonly Task[] = DECORATIONS.map((_, i) => ({
  kind: KINDS.length > 0 ? KINDS[i % KINDS.length] : DEFAULT_TASKS[i].kind,
  count: EVERY ?? DEFAULT_TASKS[i].count,
}));

// A watering counts only on a plot nobody has watered for this long, so one plot
// watered over and over is worth one watering, not many.
export const DECORATION_GAP_MS = Number(process.env.DECORATION_GAP_MS ?? 10 * 60_000);
// A cow or a hen counts again for the same gardener only after this long, so one animal
// fed or stroked over and over is worth one, not many.
export const ANIMAL_GAP_MS = Number(process.env.ANIMAL_GAP_MS ?? 60_000);
// How many of each animal the garden has: the page draws this many, numbered from 0.
export const ANIMALS = { cow: 5, hen: 4 } as const;

export function decorationById(id: unknown): Decoration | undefined {
  return DECORATIONS.find((d) => d.id === id);
}

export function spotKind(spot: unknown): "fence" | "prop" | null {
  if (typeof spot !== "string" || !SPOTS.includes(spot)) return null;
  return spot === "fence" ? "fence" : "prop";
}

// What one gardener has, as it is sent to them: what is unlocked, the one task they are on
// and how many of it are left (null once all are unlocked), and what they have put where.
export interface DecorationState {
  unlocked: string[];
  next: { do: TaskKind; left: number } | null;
  placed: Record<string, string>;
}

export function stateFor(stage: number, progress: number, placed: Record<string, string>): DecorationState {
  const count = Math.min(stage, DECORATIONS.length);
  return {
    unlocked: DECORATIONS.slice(0, count).map((d) => d.id),
    next: count >= DECORATIONS.length ? null : { do: TASKS[count].kind, left: TASKS[count].count - progress },
    placed,
  };
}

// Whether a watering counts: the plot has not been watered (or planted, which waters
// it) in the last DECORATION_GAP_MS.
export function wateringCounts(lastWateredAt: number | null, now: number): boolean {
  return lastWateredAt === null || now - lastWateredAt >= DECORATION_GAP_MS;
}
