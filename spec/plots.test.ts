import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { newVisitor, plantFor, readPlots, sleep, startApp, waitUntil, type PrivateApp, NO_PLANT_LIMIT } from "./support.ts";

// The garden's rules: who can plant, water and compost what, and when.
// Each test uses its own plot so they don't depend on each other. These run
// against a private copy of the server with a short wilt window and an empty
// database (see spec/support.ts), so the wilted-plot rules can be checked in
// seconds instead of 18 hours.
// Most of these checks are not about wilting, so their server never lets a plant wilt
// however slow the machine is. The two that are about wilting use their own, below.
const WILT_MS = 4000;

let app: PrivateApp;
let wilting: PrivateApp;
beforeAll(async () => {
  app = await startApp({ WILT_WINDOW_MS: "1000000", ...NO_PLANT_LIMIT });
  wilting = await startApp({ WILT_WINDOW_MS: String(WILT_MS), ...NO_PLANT_LIMIT });
});
afterAll(async () => {
  await app.stop();
  await wilting.stop();
});

const plotAt = async (position: number, from: PrivateApp = app) => (await readPlots(from.url)).find((p) => p.position === position)!;

describe("planting", () => {
  it("plants an empty plot and records who planted it", async () => {
    const alice = newVisitor(app.url);
    const { status, body } = await alice.post(0, "plant", { type: plantFor(0) });
    expect(status).toBe(200);
    expect(body.state).toBe("planted");
    expect(body.plantedBy).toBe(publicId(alice.gid));
    expect(body.lastWateredBy).toBe(publicId(alice.gid));
  });

  it("refuses to plant a plot that already has a plant, and leaves it untouched", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    expect((await alice.post(1, "plant", { type: plantFor(1) })).status).toBe(200);

    expect((await bob.post(1, "plant", { type: plantFor(1) })).status).toBe(409);
    expect((await plotAt(1)).plantedBy).toBe(publicId(alice.gid));
  });

  it("lets only one of two simultaneous plants win", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    const results = await Promise.all([alice.post(2, "plant", { type: plantFor(2) }), bob.post(2, "plant", { type: plantFor(2) })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("plants in the other beds just as in the first", async () => {
    const alice = newVisitor(app.url);
    // A plant each bed takes: lavender in The Cottage Garden, a flower in The Flower
    // Garden, a tree in The Fruit Garden and a vegetable in The Vegetable Garden.
    for (const [position, type] of [[8, "lavender"], [30, "flower"], [60, "tree"], [99, "vegetable"]] as const) {
      expect((await alice.post(position, "plant", { type })).status).toBe(200);
      expect((await alice.post(position, "water")).status).toBe(200);
      expect(await plotAt(position)).toMatchObject({ plantType: type, plantedBy: publicId(alice.gid) });
      expect((await newVisitor(app.url).post(position, "plant", { type })).status).toBe(409);
    }
  });

  it("rejects a position outside the beds", async () => {
    const { status } = await newVisitor(app.url).post(100, "plant", { type: plantFor(100) });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it("doesn't know any action other than plant, water and compost", async () => {
    expect((await newVisitor(app.url).post(3, "uproot")).status).toBe(404);
  });
});

describe("plant types", () => {
  it("plants every kind of plant as asked, in a bed that takes it, and a tree if not told", async () => {
    const alice = newVisitor(app.url);
    // Where each kind goes: the Cottage Garden takes lavender, rosemary and foxglove, the
    // Flower Garden a tulip (stored as flower), a sunflower and a shrub, the Fruit Garden an
    // apple tree (stored as tree), a strawberry and a blueberry, and the Vegetable Garden a
    // carrot (stored as vegetable), a tomato and a lettuce.
    const plan: [number, string][] = [
      [12, "lavender"], [13, "rosemary"], [14, "foxglove"],
      [26, "flower"], [27, "sunflower"], [28, "shrub"],
      [51, "tree"], [53, "strawberry"], [54, "blueberry"],
      [76, "vegetable"], [77, "tomato"], [78, "lettuce"],
    ];
    for (const [position, type] of plan) {
      expect((await alice.post(position, "plant", { type })).body.plantType).toBe(type);
    }
    // Leaving the type out plants a tree, in a bed that takes one.
    expect((await alice.post(52, "plant")).body.plantType).toBe("tree");

    // Everyone else sees the same types.
    expect((await plotAt(12)).plantType).toBe("lavender");
    expect((await plotAt(28)).plantType).toBe("shrub");
  });

  it("rejects a plant type it doesn't know and leaves the plot empty", async () => {
    const alice = newVisitor(app.url);
    expect((await alice.post(16, "plant", { type: "cactus" })).status).toBe(400);
    expect((await alice.post(16, "plant", { type: 7 })).status).toBe(400);

    const plot = await plotAt(16);
    expect(plot.state).toBe("empty");
    expect(plot.plantType).toBeNull();
  });
});

describe("watering", () => {
  it("refuses to water an empty plot", async () => {
    expect((await newVisitor(app.url).post(10, "water")).status).toBe(409);
  });

  it("lets anyone water any plot, not just their own", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    await alice.post(4, "plant", { type: plantFor(4) });

    const { status, body } = await bob.post(4, "water");
    expect(status).toBe(200);
    expect(body.lastWateredBy).toBe(publicId(bob.gid));
    expect(body.plantedBy).toBe(publicId(alice.gid));
  });

  it("resets the wilt clock, so a watered plant outlives the unwatered window", { timeout: 20_000 }, async () => {
    const alice = newVisitor(wilting.url);
    await alice.post(5, "plant", { type: plantFor(5) });

    await sleep(WILT_MS * 0.6);
    expect((await alice.post(5, "water")).status).toBe(200);

    // Now more than a full window since planting, but well under one since
    // the watering: it must still be alive.
    await sleep(WILT_MS * 0.6);
    expect((await alice.post(5, "water")).status).toBe(200);
  });
});

describe("composting", () => {
  it("refuses to compost an empty plot", async () => {
    expect((await newVisitor(app.url).post(11, "compost")).status).toBe(409);
  });

  it("refuses to compost a plant that is still alive", async () => {
    const alice = newVisitor(app.url);
    await alice.post(6, "plant", { type: plantFor(6) });

    expect((await alice.post(6, "compost")).status).toBe(409);
    expect((await plotAt(6)).state).toBe("planted");
  });

  it(
    "leaves a wilted plot unwaterable and unplantable until someone composts it",
    { timeout: 20_000 },
    async () => {
      const alice = newVisitor(wilting.url);
      const bob = newVisitor(wilting.url);
      await alice.post(7, "plant", { type: plantFor(7) });

      await waitUntil(() => plotAt(7, wilting), (p) => p.state === "wilted");

      expect((await bob.post(7, "water")).status).toBe(409);
      expect((await bob.post(7, "plant", { type: plantFor(7) })).status).toBe(409);

      const composted = await bob.post(7, "compost");
      expect(composted.status).toBe(200);
      expect(composted.body.state).toBe("empty");
      expect(composted.body.plantedBy).toBeNull();

      // Once composted it is an ordinary empty plot, so it can take a plant its bed takes.
      const replanted = await bob.post(7, "plant", { type: "rosemary" });
      expect(replanted.status).toBe(200);
      expect(replanted.body.plantType).toBe("rosemary");
    },
  );
});

describe("a vegetable", () => {
  it("grows through the same stages as the other plants, at its own pace", { timeout: 30_000 }, async () => {
    // Stages long enough that a slow machine cannot skip one between two looks. A
    // carrot takes 0.6 of a tree's time: mature at 2.7 s against the tree's 4.5 s.
    const stagesApp = await startApp({
      SEED_TO_SPROUT_MS: "1500",
      SPROUT_TO_GROWING_MS: "1500",
      GROWING_TO_MATURE_MS: "1500",
      WILT_WINDOW_MS: "1000000",
    });
    try {
      const alice = newVisitor(stagesApp.url);
      await alice.post(80, "plant", { type: "vegetable" });
      await alice.post(60, "plant", { type: "tree" });

      const stateAt = async (position: number) => (await readPlots(stagesApp.url)).find((p) => p.position === position)!.state;
      const planted = await stateAt(80);
      expect(["planted", "sprout"]).toContain(planted);

      // It passes through the early stages (the first look after it leaves "planted"
      // is a sprout or growing), and gets to mature, quicker than a tree does.
      const left = await waitUntil(() => stateAt(80), (s) => s !== "planted");
      expect(["sprout", "growing"]).toContain(left);
      await waitUntil(() => stateAt(80), (s) => s === "mature");
      expect(await stateAt(60)).not.toBe("mature");
    } finally {
      await stagesApp.stop();
    }
  });
});
