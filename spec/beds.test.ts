import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { type PrivateApp, newVisitor, openStream, readPlots, sleep, startApp } from "./support.ts";

// Each bed takes only what it is for. The server decides, so a request sent by hand
// gets the same answer as a click in the page. Only planting is restricted: anyone
// may water or compost in any bed. Plots 25 to 49 are The Flower Garden, 50 to 74 The
// Fruit Garden and 75 to 99 The Vegetable Garden.
const FLOWER_GARDEN = [25, 49];
const FRUIT_GARDEN = [50, 74];
const VEGETABLE_GARDEN = [75, 99];

let app: PrivateApp;
beforeAll(async () => {
  app = await startApp({ WILT_WINDOW_MS: "1500", ACTION_LIMIT: "1000" });
});
afterAll(async () => {
  await app.stop();
});

const plotAt = async (position: number) => (await readPlots(app.url)).find((p) => p.position === position)!;

describe("The Flower Garden", () => {
  it("takes a tulip, a sunflower and a flower shrub", async () => {
    const alice = newVisitor(app.url);
    expect((await alice.post(FLOWER_GARDEN[0], "plant", { type: "flower" })).status).toBe(200);
    expect((await alice.post(26, "plant", { type: "shrub" })).status).toBe(200);
    expect((await alice.post(27, "plant", { type: "sunflower" })).status).toBe(200);
    expect(await plotAt(27)).toMatchObject({ plantType: "sunflower" });
    expect(await plotAt(26)).toMatchObject({ plantType: "shrub", plantedBy: publicId(alice.gid) });
  });

  it("turns a tree away, with a message that says what it takes, and changes nothing", async () => {
    const alice = newVisitor(app.url);
    const refused = await alice.post(30, "plant", { type: "tree" });
    expect(refused.status).toBe(409);
    expect((refused.body as unknown as { error: string }).error).toMatch(/Flower Garden only takes tulips, sunflowers and flower shrubs/);
    expect((await plotAt(30)).state).toBe("empty");

    // The default plant is a tree, so leaving the type out is turned away too.
    expect((await alice.post(31, "plant")).status).toBe(409);
    expect((await plotAt(31)).state).toBe("empty");
  });

  it("is turned away at both ends of the bed, and not beyond it", async () => {
    const alice = newVisitor(app.url);
    expect((await alice.post(FLOWER_GARDEN[0], "plant", { type: "tree" })).status).toBe(409);
    expect((await alice.post(FLOWER_GARDEN[1], "plant", { type: "tree" })).status).toBe(409);
    // The plots either side are in beds that take anything.
    expect((await alice.post(FLOWER_GARDEN[0] - 1, "plant", { type: "tree" })).status).toBe(200);
    expect((await alice.post(FLOWER_GARDEN[1] + 1, "plant", { type: "tree" })).status).toBe(200);
  });

  it("lets anyone water and compost there, as in any bed", { timeout: 15_000 }, async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    await alice.post(35, "plant", { type: "flower" });
    expect((await bob.post(35, "water")).status).toBe(200);

    await sleep(1800);
    expect((await bob.post(35, "compost")).status).toBe(200);
    expect((await plotAt(35)).state).toBe("empty");
  });
});

describe("The Fruit Garden", () => {
  it("takes a fruit tree, which is the tree, and nothing else", async () => {
    const alice = newVisitor(app.url);
    expect((await alice.post(51, "plant", { type: "tree" })).status).toBe(200);
    // The default plant is a tree, so leaving the type out is a fruit tree.
    expect((await alice.post(52, "plant")).status).toBe(200);
    expect(await plotAt(52)).toMatchObject({ plantType: "tree" });

    for (const type of ["flower", "sunflower", "shrub"]) {
      const refused = await alice.post(55, "plant", { type });
      expect(refused.status).toBe(409);
      expect((refused.body as unknown as { error: string }).error).toMatch(/Fruit Garden only takes fruit trees/);
    }
    expect((await plotAt(55)).state).toBe("empty");
  });

  it("is turned away at both ends of the bed, and not beyond it", async () => {
    const alice = newVisitor(app.url);
    expect((await alice.post(FRUIT_GARDEN[0], "plant", { type: "flower" })).status).toBe(409);
    expect((await alice.post(FRUIT_GARDEN[1], "plant", { type: "flower" })).status).toBe(409);
    expect((await alice.post(FRUIT_GARDEN[0] - 1, "plant", { type: "tree" })).status).toBe(409); // the Flower Garden
    // The plot just past it is The Vegetable Garden's first, which takes a vegetable but not a tree.
    expect((await alice.post(FRUIT_GARDEN[1] + 1, "plant", { type: "tree" })).status).toBe(409);
  });

  it("lets anyone water there", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    await alice.post(60, "plant", { type: "tree" });
    expect((await bob.post(60, "water")).status).toBe(200);
  });
});

describe("The Vegetable Garden", () => {
  it("takes a vegetable and nothing else", async () => {
    const alice = newVisitor(app.url);
    expect((await alice.post(VEGETABLE_GARDEN[0], "plant", { type: "vegetable" })).status).toBe(200);
    expect((await alice.post(VEGETABLE_GARDEN[1], "plant", { type: "vegetable" })).status).toBe(200);

    for (const type of ["tree", "flower", "sunflower", "shrub"]) {
      const refused = await alice.post(80, "plant", { type });
      expect(refused.status).toBe(409);
      expect((refused.body as unknown as { error: string }).error).toMatch(/Vegetable Garden only takes vegetables/);
    }
    // Leaving the type out plants a tree, which is turned away.
    expect((await alice.post(81, "plant")).status).toBe(409);
    expect((await plotAt(80)).state).toBe("empty");
  });

  it("lets anyone water there", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    await alice.post(82, "plant", { type: "vegetable" });
    expect((await bob.post(82, "water")).status).toBe(200);
  });
});

describe("The Cottage Garden, the bed that takes anything", () => {
  it("takes a fruit tree, a flower, a sunflower, a flower shrub and a vegetable", async () => {
    const alice = newVisitor(app.url);
    expect((await alice.post(10, "plant", { type: "tree" })).status).toBe(200);
    expect((await alice.post(11, "plant", { type: "flower" })).status).toBe(200);
    expect((await alice.post(12, "plant", { type: "shrub" })).status).toBe(200);
    expect((await alice.post(13, "plant", { type: "vegetable" })).status).toBe(200);
    expect((await alice.post(14, "plant", { type: "sunflower" })).status).toBe(200);
  });
});

describe("what a turned-away plant leaves behind", () => {
  it("is logged with who and why, and never the cookie", async () => {
    const alice = newVisitor(app.url);
    await alice.post(40, "plant", { type: "tree" });

    const lines = app.logs().filter((l) => l.startsWith(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=plant plot=40 type=tree result=refused reason=wrong-bed"))).toBe(true);
    expect(app.logs().join("\n")).not.toContain(alice.gid);
  });

  it("counts against the person's limit like any other refusal", async () => {
    const limited = await startApp({ ACTION_LIMIT: "3", ACTION_WINDOW_MS: "60000" });
    try {
      const alice = newVisitor(limited.url);
      for (let i = 0; i < 3; i++) expect((await alice.post(41 + i, "plant", { type: "tree" })).status).toBe(409);
      expect((await alice.post(44, "plant", { type: "flower" })).status).toBe(429);
    } finally {
      await limited.stop();
    }
  });
});

describe("what the page is told", () => {
  it("opens with each bed's name and what it takes", async () => {
    const stream = await openStream(app.url, newVisitor(app.url).gid);
    try {
      const hello = (await stream.waitFor((f) => f.event === "hello")).data as {
        beds: { name: string; takes: string[] | null }[];
      };
      expect(hello.beds).toHaveLength(4);
      expect(hello.beds[0]).toEqual({ name: "The Cottage Garden", takes: null });
      expect(hello.beds[1]).toEqual({ name: "The Flower Garden", takes: ["flower", "sunflower", "shrub"] });
      expect(hello.beds[2]).toEqual({ name: "The Fruit Garden", takes: ["tree"] });
      expect(hello.beds[3]).toEqual({ name: "The Vegetable Garden", takes: ["vegetable"] });
      expect(hello.beds.filter((b) => b.takes === null)).toHaveLength(1);
    } finally {
      stream.close();
    }
  });
});
