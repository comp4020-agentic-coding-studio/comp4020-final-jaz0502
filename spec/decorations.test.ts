import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { fresh, newVisitor, openStream, plantFor, sleep, startApp, type PrivateApp, type Stream, NO_PLANT_LIMIT } from "./support.ts";

// Decorations for your own garden, unlocked by watering the shared one. They are a
// private reward: only the gardener who earned them is told, and nothing here changes
// what anyone can do to a plot. Each test uses a private copy of the server where every
// 2 counting waterings unlock the next decoration, and a plot must rest 400 ms before
// another watering of it counts.
const open: Stream[] = [];
afterEach(() => {
  for (const stream of open.splice(0)) stream.close();
});

interface Decorations {
  unlocked: string[];
  nextIn: number | null;
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

async function decorate(app: PrivateApp, gid: string, body: unknown) {
  const res = await fetch(new URL("/api/own-garden/decorate", app.url), {
    method: "POST",
    headers: { cookie: `gid=${gid}`, "content-type": "application/json", ...fresh },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Decorations & { error?: string } };
}

// The gap a plot must rest before another watering of it counts. The checks about the
// gap itself ("these waterings came too soon") need it long enough that a busy machine
// cannot stall past it halfway through, so they use a long one. The rest only need a
// watering to count, so a short one keeps them quick.
const LONG_GAP = 2500;
const SHORT_GAP = 400;
const env = (gap: number) => ({ DECORATION_EVERY: "2", DECORATION_GAP_MS: String(gap), ACTION_LIMIT: "1000", ...NO_PLANT_LIMIT });

// Plants these plots, then waits until all of them have rested long enough that a
// watering counts. A sleep never ends early, so this is safe on a slow machine.
async function plantRested(
  gardener: { post: (p: number, a: string, b?: unknown) => Promise<unknown> },
  plots: number[],
  gap: number,
) {
  for (const plot of plots) await gardener.post(plot, "plant", { type: plantFor(plot) });
  await sleep(gap + 100);
}

describe("unlocking decorations by watering the shared garden", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp(env(LONG_GAP));
  });
  afterAll(async () => {
    await app.stop();
  });

  it("starts with nothing unlocked and says how many waterings until the first", async () => {
    const stream = await join(app, newVisitor(app.url).gid);
    expect(frames(stream)).toEqual([{ unlocked: [], nextIn: 2, placed: {} }]);
  });

  it("unlocks the next decoration in a fixed order every so many waterings", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    await plantRested(alice, [0, 1, 2, 3], LONG_GAP);

    await alice.post(0, "water");
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).nextIn === 1);
    expect(frames(stream).at(-1)!.unlocked).toEqual([]);

    await alice.post(1, "water");
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 1);
    expect(frames(stream).at(-1)).toEqual({ unlocked: ["bench"], nextIn: 2, placed: {} });

    await alice.post(2, "water");
    await alice.post(3, "water");
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 2);
    expect(frames(stream).at(-1)!.unlocked).toEqual(["bench", "picket"]);
  });

  it("counts a plot's watering only once until it has rested", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    await plantRested(alice, [4], LONG_GAP);

    for (let i = 0; i < 5; i++) await alice.post(4, "water");
    await sleep(200);
    // The first counted and the other four came too soon after it.
    expect(frames(stream).at(-1)).toEqual({ unlocked: [], nextIn: 1, placed: {} });

    await sleep(LONG_GAP + 100);
    await alice.post(4, "water");
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 1);
  });

  it("does not count a plant just planted, or anything in your own garden", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    await alice.post(5, "plant", { type: plantFor(5) });
    // Watering straight after planting is too soon: planting waters the plot.
    await alice.post(5, "water");
    await sleep(200);
    expect(frames(stream).at(-1)).toEqual({ unlocked: [], nextIn: 2, placed: {} });

    // Your own garden is yours: tending it earns nothing.
    const own = await fetch(new URL("/api/own-garden/0/water", app.url), {
      method: "POST",
      headers: { cookie: `gid=${alice.gid}`, ...fresh },
    });
    expect(own.status).toBe(409);
    expect(frames(stream).at(-1)!.nextIn).toBe(2);
  });

  it("counts a watering of someone else's plant", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    const stream = await join(app, bob.gid);
    await plantRested(alice, [6, 7], LONG_GAP);
    await bob.post(6, "water");
    await bob.post(7, "water");
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 1);
  });
});

describe("placing decorations", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp(env(SHORT_GAP));
  });
  afterAll(async () => {
    await app.stop();
  });

  async function unlockTwo() {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    await plantRested(alice, [0, 1, 2, 3], SHORT_GAP);
    for (const plot of [0, 1, 2, 3]) await alice.post(plot, "water");
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).unlocked.length === 2);
    return { alice, stream };
  }

  it("turns away a decoration that is not unlocked, and logs why", async () => {
    const alice = newVisitor(app.url);
    const refused = await decorate(app, alice.gid, { spot: "prop-0", decoration: "bench" });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/haven't unlocked/);
    await app.settled();
    const lines = app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=decorate spot=prop-0 decoration=bench result=refused reason=locked"))).toBe(true);
  });

  it("places an unlocked decoration and tells only its owner", async () => {
    const { alice, stream } = await unlockTwo();
    const bob = newVisitor(app.url);
    const bobStream = await join(app, bob.gid);

    expect((await decorate(app, alice.gid, { spot: "prop-1", decoration: "bench" })).status).toBe(200);
    await stream.waitFor((f) => f.event === "decorations" && (f.data as Decorations).placed["prop-1"] === "bench");
    await sleep(300);

    expect(frames(bobStream)).toEqual([{ unlocked: [], nextIn: 2, placed: {} }]);
    expect(bobStream.frames.some((f) => f.event === "activity" && (f.data as { did: string }).did === "decorate")).toBe(false);
    expect(stream.raw()).not.toContain(alice.gid);

    // It is kept: a new stream is told what is placed.
    const again = await join(app, alice.gid);
    expect(frames(again)[0].placed).toEqual({ "prop-1": "bench" });

    // And it can be taken off the spot (the decoration itself stays unlocked).
    expect((await decorate(app, alice.gid, { spot: "prop-1", decoration: null })).body.placed).toEqual({});
    expect((await decorate(app, alice.gid, { spot: "prop-1", decoration: "bench" })).status).toBe(200);
  });

  it("puts fences on the fence spot and props on the prop spots only", async () => {
    const { alice } = await unlockTwo();
    expect((await decorate(app, alice.gid, { spot: "fence", decoration: "picket" })).status).toBe(200);
    expect((await decorate(app, alice.gid, { spot: "fence", decoration: "bench" })).status).toBe(400);
    expect((await decorate(app, alice.gid, { spot: "prop-0", decoration: "picket" })).status).toBe(400);
    expect((await decorate(app, alice.gid, { spot: "prop-9", decoration: "bench" })).status).toBe(400);
    expect((await decorate(app, alice.gid, { spot: "prop-0", decoration: "nothing" })).status).toBe(400);
  });

  it("only changes how your own garden looks, never the shared garden", async () => {
    const { alice } = await unlockTwo();
    const before = await fetch(new URL("/events", app.url), { headers: fresh }).then(async (res) => {
      const reader = res.body!.getReader();
      let raw = "";
      while (!raw.includes("event: snapshot\ndata: ") || !raw.endsWith("\n\n")) raw += new TextDecoder().decode((await reader.read()).value);
      await reader.cancel();
      return raw.split("\n\n").find((b) => b.startsWith("event: snapshot"));
    });
    await decorate(app, alice.gid, { spot: "prop-2", decoration: "bench" });
    const after = await fetch(new URL("/events", app.url), { headers: fresh }).then(async (res) => {
      const reader = res.body!.getReader();
      let raw = "";
      while (!raw.includes("event: snapshot\ndata: ") || !raw.endsWith("\n\n")) raw += new TextDecoder().decode((await reader.read()).value);
      await reader.cancel();
      return raw.split("\n\n").find((b) => b.startsWith("event: snapshot"));
    });
    expect(after).toBe(before);
  });

  it("logs each unlock, by public id and never the cookie", async () => {
    const { alice } = await unlockTwo();
    await app.settled();
    const lines = app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=unlock decoration=bench"))).toBe(true);
    expect(lines.some((l) => l.includes("did=unlock decoration=picket"))).toBe(true);
    expect(app.logs().some((l) => l.includes(alice.gid))).toBe(false);
  });
});

describe("decorations and the action limit", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({ ...env(SHORT_GAP), ACTION_LIMIT: "3", ACTION_WINDOW_MS: "60000" });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("counts against the same budget as planting, watering and composting", async () => {
    const alice = newVisitor(app.url);
    for (let i = 0; i < 3; i++) expect((await decorate(app, alice.gid, { spot: "prop-0", decoration: "bench" })).status).toBe(409);
    expect((await decorate(app, alice.gid, { spot: "prop-0", decoration: "bench" })).status).toBe(429);
    expect((await alice.post(0, "plant", { type: plantFor(0) })).status).toBe(429);
  });
});
