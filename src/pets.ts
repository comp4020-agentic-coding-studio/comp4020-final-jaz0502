// A pet for your own garden: the next reward after the last decoration, in the same fixed
// order, so nobody chooses what to chase. It is private to the gardener, like their seeds
// and decorations: only they are told, it is kept by public id and never the cookie, and
// it is never taken back, renamed away or compared with anyone's.
import { MAX_CREDIT } from "./decorations.ts";

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
// and digits only, so it can never carry markup, spaces or `=` that could forge a log line
// or break a page. It is never logged and never sent to anyone but its owner.
export const PET_NAME_MAX = 12;
const PET_NAME = new RegExp(`^[A-Za-z0-9]{1,${PET_NAME_MAX}}$`);

export function validPetName(name: unknown): name is string {
  return typeof name === "string" && PET_NAME.test(name);
}

export function petKindOf(kind: unknown): PetKind | undefined {
  return PET_KINDS.find((k) => k === kind);
}

// A pet unlocks once every decoration has, and credit never goes down.
export function petUnlocked(credit: number): boolean {
  return credit >= MAX_CREDIT;
}
