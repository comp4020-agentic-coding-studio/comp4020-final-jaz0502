export type PlotState = "empty" | "planted" | "sprout" | "mature" | "wilted";

export interface Plot {
  position: number;
  state: PlotState;
  plantedAt: number | null;
  plantedBy: string | null;
  lastWateredAt: number | null;
  lastWateredBy: string | null;
}
