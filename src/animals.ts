// Feeding a cow and stroking a hen. The animals are drawn only in each visitor's own page,
// so the server only hears that a gardener did it, to count it towards their next
// decoration. It changes nothing in the garden, is never broadcast or put in Recent, and one
// animal counts again for the same gardener only after ANIMAL_GAP_MS, so one cow fed over
// and over is worth one. Held in memory only, keyed by the public id, and capped.
import { ANIMAL_GAP_MS, ANIMALS } from "./decorations.ts";

export type AnimalKind = keyof typeof ANIMALS;

const MAX_TRACKED = 5000;
const last = new Map<string, number>();

export function animalIndex(kind: AnimalKind, value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < ANIMALS[kind] ? value : null;
}

// Whether this gardener's care of this animal counts now, and if so, remembers it.
export function animalCounts(who: string, kind: AnimalKind, index: number, now: number): boolean {
  const key = `${who}:${kind}:${index}`;
  const before = last.get(key);
  if (before !== undefined && now - before < ANIMAL_GAP_MS) return false;
  if (!last.has(key) && last.size >= MAX_TRACKED) {
    for (const [k, t] of last) if (now - t >= ANIMAL_GAP_MS) last.delete(k);
    if (last.size >= MAX_TRACKED) last.delete(last.keys().next().value!);
  }
  last.delete(key);
  last.set(key, now);
  return true;
}
