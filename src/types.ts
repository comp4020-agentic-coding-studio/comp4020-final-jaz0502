export type PlotState = "empty" | "planted" | "sprout" | "tree" | "fruiting" | "wilted";

export interface Plot {
  position: number;
  state: PlotState;
  plantedAt: number | null;
  plantedBy: string | null;
  lastWateredAt: number | null;
  lastWateredBy: string | null;
}
