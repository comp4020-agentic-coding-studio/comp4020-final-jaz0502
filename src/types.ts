export type PlantType = "tree" | "flower" | "shrub";

// Derived from timestamps, never stored (only empty/planted are). `growing`
// and `mature` are generic so each plant type can draw its own: a tree grows
// and then fruits, a flower grows and then blooms, and so on.
export type PlotState = "empty" | "planted" | "sprout" | "growing" | "mature" | "wilted";

export interface Plot {
  position: number;
  state: PlotState;
  plantType: PlantType | null;
  plantedAt: number | null;
  plantedBy: string | null;
  lastWateredAt: number | null;
  lastWateredBy: string | null;
}
