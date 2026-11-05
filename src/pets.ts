// A pet for your own garden: the next reward after the last decoration, in the same fixed
// order, so nobody chooses what to chase. It is private to the gardener, like their seeds
// and decorations: only they are told, it is kept by public id and never the cookie, and
// it is never taken back, renamed away or compared with anyone's.
import { DECORATIONS } from "./decorations.ts";

export const PET_KINDS = ["cat", "dog", "rabbit"] as const;
export type PetKind = (typeof PET_KINDS)[number];

export interface Pet {
  kind: PetKind;
  name: string;
}

// What one gardener is told: whether a pet is waiting for them, and the one they have.
export interface PetState {
  unlocked: boolean;
  pet: Pet | null;
}

// The name is the one piece of text a stranger can type, so it is kept very small: letters
// only, so it can never carry markup, digits, spaces or `=` that could forge a log line or
// break a page. The server makes the first letter a capital, so it reads the same whatever
// was typed. It is never logged and never sent to anyone but its owner.
export const PET_NAME_MAX = 12;
const PET_NAME = new RegExp(`^[A-Za-z]{1,${PET_NAME_MAX}}$`);

export function validPetName(name: unknown): name is string {
  return typeof name === "string" && PET_NAME.test(name);
}

// "mochi" and "mOCHI" are kept as "Mochi": the first letter a capital, the rest as typed.
export function tidyPetName(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function petKindOf(kind: unknown): PetKind | undefined {
  return PET_KINDS.find((k) => k === kind);
}

// A pet unlocks once every decoration has, and the stage never goes down.
export function petUnlocked(stage: number): boolean {
  return stage >= DECORATIONS.length;
}
