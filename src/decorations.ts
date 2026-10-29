// Decorations for your own garden, unlocked by looking after the shared one. The list
// is fixed and in a fixed order, so nobody chooses what to chase: every EVERY
// waterings that count unlocks the next one. They are private to the gardener, like
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

// Env-overridable so specs can use a small number and a short gap.
// Every this many counting waterings unlocks the next decoration.
export const WATERINGS_PER_DECORATION = Number(process.env.DECORATION_EVERY ?? 10);
// A watering counts only on a plot nobody has watered for this long, so one plot
// watered over and over is worth one watering, not many.
export const DECORATION_GAP_MS = Number(process.env.DECORATION_GAP_MS ?? 10 * 60_000);

// Once everything is unlocked there is nothing more to count towards.
export const MAX_CREDIT = WATERINGS_PER_DECORATION * DECORATIONS.length;

export function decorationById(id: unknown): Decoration | undefined {
  return DECORATIONS.find((d) => d.id === id);
}

export function spotKind(spot: unknown): "fence" | "prop" | null {
  if (typeof spot !== "string" || !SPOTS.includes(spot)) return null;
  return spot === "fence" ? "fence" : "prop";
}

// What one gardener has, as it is sent to them: what is unlocked, how many more
// counting waterings until the next one (null once all are unlocked), and what they
// have put where.
export interface DecorationState {
  unlocked: string[];
  nextIn: number | null;
  placed: Record<string, string>;
}

export function stateFor(credit: number, placed: Record<string, string>): DecorationState {
  const count = Math.min(Math.floor(credit / WATERINGS_PER_DECORATION), DECORATIONS.length);
  return {
    unlocked: DECORATIONS.slice(0, count).map((d) => d.id),
    nextIn: count >= DECORATIONS.length ? null : WATERINGS_PER_DECORATION - (credit % WATERINGS_PER_DECORATION),
    placed,
  };
}

// Whether a watering counts: the plot has not been watered (or planted, which waters
// it) in the last DECORATION_GAP_MS.
export function wateringCounts(lastWateredAt: number | null, now: number): boolean {
  return lastWateredAt === null || now - lastWateredAt >= DECORATION_GAP_MS;
}
