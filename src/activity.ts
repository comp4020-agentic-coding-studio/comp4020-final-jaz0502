// A short list of what gardeners have just done to the garden, newest first. Held
// in memory only, like presence: it starts empty after a restart, which is fine for
// a glance at what just happened. It is a few recent lines, not a history: it holds
// no counts and no totals, and nothing here can be asked for one gardener's actions.
// Entries name the gardener by public id; the cookie never comes in.

import type { PlantType } from "./types.ts";

export interface Activity {
  id: string;
  did: "plant" | "water" | "compost";
  plot: number;
  // Which plant, for a planting.
  type?: PlantType;
}

export const MAX_ACTIVITY = 8;

const recent: Activity[] = [];

export function recordActivity(entry: Activity): Activity {
  recent.unshift(entry);
  recent.length = Math.min(recent.length, MAX_ACTIVITY);
  return entry;
}

export function recentActivity(): Activity[] {
  return [...recent];
}
