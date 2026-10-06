import { expect, it } from "vitest";

// How a plant moves through its stages is a pure function of its timestamps
// (derivePlot), so it is checked here directly with made-up times instead of
// by waiting. The module reads its durations from the environment when it is
// loaded, so set them first: a tree sprouts at 1s, grows at 5s and is mature at
// 10s; a flower takes half as long and a flower shrub three quarters.
process.env.SEED_TO_SPROUT_MS = "1000";
process.env.SPROUT_TO_GROWING_MS = "4000";
process.env.GROWING_TO_MATURE_MS = "5000";
process.env.WILT_WINDOW_MS = "20000";
const { derivePlot } = await import("../src/garden.ts");

type PlantType = "tree" | "flower" | "shrub";

const stageAt = (plantType: PlantType, age: number): string =>
  derivePlot(
    {
      position: 0,
      state: "planted",
      plantType,
      plantedAt: 0,
      plantedBy: "someone",
      lastWateredAt: 0,
      lastWateredBy: "someone",
    },
    age,
  ).state;

it("moves a tree through its stages at the tree's own times", () => {
  expect(stageAt("tree", 500)).toBe("planted");
  expect(stageAt("tree", 1000)).toBe("sprout");
  expect(stageAt("tree", 4999)).toBe("sprout");
  expect(stageAt("tree", 5000)).toBe("growing");
  expect(stageAt("tree", 9999)).toBe("growing");
  expect(stageAt("tree", 10000)).toBe("mature");
});

it("grows a flower in half the time and a flower shrub in three quarters", () => {
  expect(stageAt("flower", 499)).toBe("planted");
  expect(stageAt("flower", 500)).toBe("sprout");
  expect(stageAt("flower", 2500)).toBe("growing");
  expect(stageAt("flower", 5000)).toBe("mature");

  expect(stageAt("shrub", 749)).toBe("planted");
  expect(stageAt("shrub", 750)).toBe("sprout");
  expect(stageAt("shrub", 3750)).toBe("growing");
  expect(stageAt("shrub", 7500)).toBe("mature");
});

it("has a flower ahead of a tree planted at the same moment", () => {
  expect(stageAt("flower", 5000)).toBe("mature");
  expect(stageAt("tree", 5000)).toBe("growing");
});

it("wilts every type after the same time without water", () => {
  for (const type of ["tree", "flower", "shrub"] as const) {
    expect(stageAt(type, 20000)).not.toBe("wilted");
    expect(stageAt(type, 20001)).toBe("wilted");
  }
});

it("leaves an empty plot empty", () => {
  expect(
    derivePlot(
      {
        position: 0,
        state: "empty",
        plantType: null,
        plantedAt: null,
        plantedBy: null,
        lastWateredAt: null,
        lastWateredBy: null,
      },
      99999,
    ).state,
  ).toBe("empty");
});
