import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { fresh, newVisitor, openStream, plantFor, readPlots, sleep, startApp, waitUntil, type PrivateApp, type Stream } from "./support.ts";

// Gathering seeds from a fully grown plant. It never changes the plant, and the seeds
// go to the one who gathered them and nobody else. Each test uses a private copy of
// the server where plants grow up in well under a second.
const open: Stream[] = [];
afterEach(() => {
  for (const stream of open.splice(0)) stream.close();
});

type Seeds = Record<string, number>;

async function join(app: PrivateApp, gid: string): Promise<Stream> {
  const stream = await openStream(app.url, gid);
  open.push(stream);
  await stream.waitFor((f) => f.event === "seeds");
  return stream;
}

const seedFrames = (stream: Stream): Seeds[] =>
  stream.frames.filter((f) => f.event === "seeds").map((f) => f.data as Seeds);

async function gather(app: PrivateApp, gid: string, position: number) {
  const res = await fetch(new URL(`/api/plots/${position}/gather`, app.url), {
    method: "POST",
    headers: { cookie: `gid=${gid}`, ...fresh },
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as { error?: string; gained?: number } };
}

// Waits until these plots hold fully grown plants, however busy the machine is.
const grown = (app: PrivateApp, ...positions: number[]) =>
  waitUntil(() => readPlots(app.url), (plots) => positions.every((p) => plots[p].state === "mature"));

describe("gathering seeds", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({ SEED_TO_SPROUT_MS: "50", SPROUT_TO_GROWING_MS: "50", GROWING_TO_MATURE_MS: "50" });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("only works on a fully grown plant, and leaves it exactly as it was", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    expect((await gather(app, bob.gid, 0)).status).toBe(409);

    await alice.post(0, "plant", { type: plantFor(0) });
    await grown(app, 0);
    const before = (await readPlots(app.url))[0];
    expect(before.state).toBe("mature");
    expect((await gather(app, bob.gid, 0)).status).toBe(200);
    expect((await readPlots(app.url))[0]).toEqual(before);
  });

  it("gives seeds to the gatherer's own streams only, and never puts it in Recent", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    const aliceStream = await join(app, alice.gid);
    const bobStream = await join(app, bob.gid);
    expect(seedFrames(aliceStream)).toEqual([{}]);

    await alice.post(1, "plant", { type: plantFor(1) });
    await grown(app, 1);
    expect((await gather(app, alice.gid, 1)).body.gained).toBe(3);

    await aliceStream.waitFor((f) => f.event === "seeds" && (f.data as Seeds).lavender === 3);
    await sleep(300);
    expect(seedFrames(bobStream)).toEqual([{}]);
    expect(bobStream.frames.some((f) => f.event === "activity" && (f.data as { did: string }).did === "gather")).toBe(false);
    expect(aliceStream.raw()).not.toContain(alice.gid);
  });

  it("gives seeds from one plant once to each gardener, and only so many of a kind", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    for (const plot of [2, 3, 4]) await alice.post(plot, "plant", { type: plantFor(plot) });
    await grown(app, 2, 3, 4);

    expect((await gather(app, bob.gid, 2)).body.gained).toBe(3);
    expect((await gather(app, bob.gid, 2)).status).toBe(409);
    // Someone else can still gather from the same plant.
    expect((await gather(app, alice.gid, 2)).status).toBe(200);

    expect((await gather(app, bob.gid, 3)).body.gained).toBe(3);
    const full = await gather(app, bob.gid, 4);
    expect(full.status).toBe(409);
    expect(full.body.error).toMatch(/as many/);
  });

  it("logs each gather and each refusal with a reason, by public id", async () => {
    const alice = newVisitor(app.url);
    await alice.post(5, "plant", { type: plantFor(5) });
    await gather(app, alice.gid, 6);
    await grown(app, 5);
    await gather(app, alice.gid, 5);
    await gather(app, alice.gid, 5);

    await app.settled();
    const lines = app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=gather plot=6 result=refused reason=not-mature"))).toBe(true);
    expect(lines.some((l) => l.includes("did=gather plot=5 type=lavender seeds=3 result=ok"))).toBe(true);
    expect(lines.some((l) => l.includes("did=gather plot=5 result=refused reason=already-gathered"))).toBe(true);
    expect(app.logs().some((l) => l.includes(alice.gid))).toBe(false);
  });
});

describe("gathering from a plant that is still growing", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    // The default growth times, so a plant stays young however slow the machine is.
    app = await startApp({});
  });
  afterAll(async () => {
    await app.stop();
  });

  it("is turned away, with the reason logged, and gives no seeds", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    await alice.post(0, "plant", { type: plantFor(0) });
    const refused = await gather(app, bob.gid, 0);
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/fully grown/);
    await app.settled();
    expect(app.logs().some((l) => l.includes(`who=${publicId(bob.gid)} `) && l.includes("did=gather plot=0 result=refused reason=not-mature"))).toBe(true);
  });
});

describe("gathering and the action limit", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({ ACTION_LIMIT: "3", ACTION_WINDOW_MS: "60000" });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("counts against the same budget as planting, watering and composting", async () => {
    const alice = newVisitor(app.url);
    for (let i = 0; i < 3; i++) expect((await gather(app, alice.gid, 0)).status).toBe(409);
    const refused = await fetch(new URL("/api/plots/0/gather", app.url), {
      method: "POST",
      headers: { cookie: `gid=${alice.gid}`, ...fresh },
    });
    expect(refused.status).toBe(429);
    expect((await alice.post(1, "plant", { type: plantFor(1) })).status).toBe(429);
  });
});
