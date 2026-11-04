import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { fresh, newVisitor, openStream, plantFor, readPlots, sleep, startApp, waitUntil, type PrivateApp, type Stream, NO_PLANT_LIMIT } from "./support.ts";

// What it takes to unlock each decoration: one task each, in a fixed order, the same for
// everyone, with only the task you are on and how many of it are left. Feeding a cow and
// stroking a hen are drawn in each page, so the server only hears of them to count them.
// Each test uses a private copy of the server where every task is one thing, the kinds go
// round in a set order, and plants grow up in well under a second.
const open: Stream[] = [];
afterEach(() => {
  for (const stream of open.splice(0)) stream.close();
});

interface Decorations {
  unlocked: string[];
  next: { do: string; left: number } | null;
  placed: Record<string, string>;
}

async function join(app: PrivateApp, gid: string): Promise<Stream> {
  const stream = await openStream(app.url, gid);
  open.push(stream);
  await stream.waitFor((f) => f.event === "decorations");
  return stream;
}

const frames = (stream: Stream): Decorations[] =>
  stream.frames.filter((f) => f.event === "decorations").map((f) => f.data as Decorations);

async function animal(app: PrivateApp, gid: string, kind: string, index: number | string) {
  const res = await fetch(new URL(`/api/animals/${kind}/${index}`, app.url), { method: "POST", headers: { cookie: `gid=${gid}`, ...fresh } });
  return res.status;
}

async function gather(app: PrivateApp, gid: string, plot: number) {
  const res = await fetch(new URL(`/api/plots/${plot}/gather`, app.url), { method: "POST", headers: { cookie: `gid=${gid}`, ...fresh } });
  return res.status;
}

const grown = (app: PrivateApp, ...positions: number[]) =>
  waitUntil(() => readPlots(app.url), (plots) => positions.every((p) => plots[p].state === "mature"));

const env = {
  DECORATION_EVERY: "2",
  DECORATION_TASKS: "feed-cow,pat-hen,plant,gather,compost,water",
  DECORATION_GAP_MS: "300",
  ANIMAL_GAP_MS: "600",
  ACTION_LIMIT: "1000",
  SEED_TO_SPROUT_MS: "50",
  SPROUT_TO_GROWING_MS: "50",
  GROWING_TO_MATURE_MS: "50",
  ...NO_PLANT_LIMIT,
};

describe("the task for each decoration", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp(env);
  });
  afterAll(async () => {
    await app.stop();
  });

  it("starts on the first task and says only what is left of it", async () => {
    const stream = await join(app, newVisitor(app.url).gid);
    expect(frames(stream)).toEqual([{ unlocked: [], next: { do: "feed-cow", left: 2 }, placed: {} }]);
  });

  it("counts only the task you are on, one decoration at a time, in a fixed order", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);

    // Stroking a hen is not the task yet, so it counts for nothing.
    expect(await animal(app, alice.gid, "hen", 0)).toBe(204);
    await sleep(150);
    expect(frames(stream)).toHaveLength(1);

    // Feeding two different cows finishes the first task.
    expect(await animal(app, alice.gid, "cow", 0)).toBe(204);
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).next?.left === 1);
    expect(await animal(app, alice.gid, "cow", 1)).toBe(204);
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 1);
    expect(frames(stream).at(-1)).toEqual({ unlocked: ["bench"], next: { do: "pat-hen", left: 2 }, placed: {} });

    // Now it is the hens. A cow no longer counts, and two hens unlock the next decoration.
    await sleep(700);
    await animal(app, alice.gid, "cow", 2);
    expect(await animal(app, alice.gid, "hen", 1)).toBe(204);
    expect(await animal(app, alice.gid, "hen", 2)).toBe(204);
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 2);
    expect(frames(stream).at(-1)).toEqual({ unlocked: ["bench", "picket"], next: { do: "plant", left: 2 }, placed: {} });

    // Planting two seeds is the third, in the shared garden.
    await alice.post(0, "plant", { type: plantFor(0) });
    await alice.post(1, "plant", { type: plantFor(1) });
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 3);
    expect(frames(stream).at(-1)!.next).toEqual({ do: "gather", left: 2 });

    // Then gathering seeds from two fully grown plants, then composting two wilted ones.
    await grown(app, 0, 1);
    expect(await gather(app, alice.gid, 0)).toBe(200);
    expect(await gather(app, alice.gid, 1)).toBe(200);
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 4);
    expect(frames(stream).at(-1)!.next).toEqual({ do: "compost", left: 2 });
  });

  it("counts an animal again for the same gardener only after it has rested", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    for (let i = 0; i < 5; i++) await animal(app, alice.gid, "cow", 3);
    await sleep(200);
    // The first counted and the rest came too soon after it.
    expect(frames(stream).at(-1)!.next).toEqual({ do: "feed-cow", left: 1 });
    await app.settled();
    expect(app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `) && l.includes("did=feed-cow animal=3 result=refused reason=too-soon")).length).toBeGreaterThan(0);

    await sleep(700);
    await animal(app, alice.gid, "cow", 3);
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 1);
  });

  it("turns away an animal there isn't, and logs why", async () => {
    const alice = newVisitor(app.url);
    for (const bad of [5, 99, -1, "x", "1.5"]) expect(await animal(app, alice.gid, "cow", bad), String(bad)).toBe(404);
    expect(await animal(app, alice.gid, "hen", 4)).toBe(404);
    await app.settled();
    const lines = app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=feed-cow result=refused reason=no-such-animal"))).toBe(true);
    expect(lines.some((l) => l.includes("did=pat-hen result=refused reason=no-such-animal"))).toBe(true);
  });

  it("never tells anyone else, never puts it in Recent, and never carries the cookie", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    const bobStream = await join(app, bob.gid);
    await animal(app, alice.gid, "cow", 0);
    await animal(app, alice.gid, "hen", 0);
    await sleep(300);
    expect(frames(bobStream)).toEqual([{ unlocked: [], next: { do: "feed-cow", left: 2 }, placed: {} }]);
    expect(bobStream.frames.some((f) => f.event === "activity")).toBe(false);
    expect(stream.raw()).not.toContain(alice.gid);
    await app.settled();
    expect(app.logs().some((l) => l.includes(alice.gid))).toBe(false);
  });

  it("logs each unlock, and says how many animals there are in hello", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    await animal(app, alice.gid, "cow", 0);
    await animal(app, alice.gid, "cow", 1);
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 1);
    await app.settled();
    expect(app.logs().some((l) => l.includes(`who=${publicId(alice.gid)} `) && l.includes("did=unlock decoration=bench"))).toBe(true);
    const hello = stream.frames.find((f) => f.event === "hello")!.data as { animals: Record<string, number> };
    expect(hello.animals).toEqual({ cow: 5, hen: 4 });
  });
});

describe("animals and the action limit", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({ ...env, ACTION_LIMIT: "3", ACTION_WINDOW_MS: "60000" });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("counts against the same budget as planting, watering and composting", async () => {
    const alice = newVisitor(app.url);
    for (let i = 0; i < 3; i++) expect(await animal(app, alice.gid, "cow", i)).toBe(204);
    expect(await animal(app, alice.gid, "cow", 3)).toBe(429);
    expect((await alice.post(0, "plant", { type: plantFor(0) })).status).toBe(429);
  });
});
