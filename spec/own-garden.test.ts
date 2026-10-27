import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { fresh, newVisitor, openStream, plantFor, readPlots, sleep, startApp, type PrivateApp, type Stream } from "./support.ts";

// Each gardener's own garden, grown from seeds they gathered. Only they can act on
// it and only they are ever told about it. Each test uses a private copy of the
// server where plants grow up in well under a second.
const open: Stream[] = [];
afterEach(() => {
  for (const stream of open.splice(0)) stream.close();
});

interface OwnPlot {
  position: number;
  state: string;
  plantType: string | null;
  plantedBy: string | null;
  lastWateredBy: string | null;
}

async function join(app: PrivateApp, gid: string): Promise<Stream> {
  const stream = await openStream(app.url, gid);
  open.push(stream);
  await stream.waitFor((f) => f.event === "own-garden");
  return stream;
}

async function own(app: PrivateApp, gid: string, position: number, action: string, body?: unknown) {
  const res = await fetch(new URL(`/api/own-garden/${position}/${action}`, app.url), {
    method: "POST",
    headers: { cookie: `gid=${gid}`, ...fresh, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as OwnPlot & { error?: string } };
}

const gather = (app: PrivateApp, gid: string, position: number) =>
  fetch(new URL(`/api/plots/${position}/gather`, app.url), { method: "POST", headers: { cookie: `gid=${gid}`, ...fresh } });

// Long enough for any plant to be fully grown with the times below.
const GROWN = 600;

// A gardener with three lavender seeds, gathered from a lavender in the given plot.
async function withSeeds(app: PrivateApp, plot: number) {
  const gardener = newVisitor(app.url);
  const planted = await gardener.post(plot, "plant", { type: plantFor(plot) });
  expect(planted.status, JSON.stringify(planted.body)).toBe(200);
  await sleep(GROWN);
  const res = await gather(app, gardener.gid, plot);
  expect(res.status, await res.text()).toBe(200);
  return gardener;
}

describe("a gardener's own garden", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({
      SEED_TO_SPROUT_MS: "50",
      SPROUT_TO_GROWING_MS: "50",
      GROWING_TO_MATURE_MS: "50",
      SWEEP_INTERVAL_MS: "200",
    });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("starts empty, and needs a seed of the kind to plant, using one up", async () => {
    const stranger = newVisitor(app.url);
    const stream = await join(app, stranger.gid);
    const first = stream.frames.find((f) => f.event === "own-garden")!.data as OwnPlot[];
    expect(first).toHaveLength(16);
    expect(first.every((p) => p.state === "empty")).toBe(true);
    expect((await own(app, stranger.gid, 0, "plant", { type: "lavender" })).status).toBe(409);

    const alice = await withSeeds(app, 0);
    const aliceStream = await join(app, alice.gid);
    expect((await own(app, alice.gid, 0, "plant", { type: "tomato" })).status).toBe(409);
    expect((await own(app, alice.gid, 0, "plant", { type: "lavender" })).status).toBe(200);
    await aliceStream.waitFor((f) => f.event === "seeds" && (f.data as Record<string, number>).lavender === 2);
    expect((await own(app, alice.gid, 0, "plant", { type: "lavender" })).status).toBe(409);
    expect((await own(app, alice.gid, 16, "plant", { type: "lavender" })).status).toBe(404);
  });

  it("is never shown to anyone else, in their stream, the shared garden or Recent", async () => {
    const alice = await withSeeds(app, 2);
    const bob = newVisitor(app.url);
    const bobStream = await join(app, bob.gid);
    const aliceStream = await join(app, alice.gid);

    await own(app, alice.gid, 4, "plant", { type: "lavender" });
    await aliceStream.waitFor((f) => f.event === "own-update" && (f.data as OwnPlot).position === 4);
    await sleep(GROWN);

    const bobsOwn = bobStream.frames.filter((f) => f.event === "own-garden" || f.event === "own-update");
    expect(bobsOwn.map((f) => f.data)).toEqual([expect.arrayContaining([expect.objectContaining({ state: "empty" })])]);
    expect((bobsOwn[0].data as OwnPlot[]).every((p) => p.state === "empty")).toBe(true);
    expect(bobStream.frames.some((f) => f.event === "activity" && (f.data as { plot: number }).plot === 4)).toBe(false);
    // The shared garden's plot 4 is still empty: the two never mix.
    expect((await readPlots(app.url))[4].state).toBe("empty");
    // And Alice's own plots never carry her name or her cookie.
    const plot = aliceStream.frames.find((f) => f.event === "own-update")!.data as OwnPlot;
    expect(plot.plantedBy).toBeNull();
    expect(aliceStream.raw()).not.toContain(alice.gid);
  });

  it("can only be acted on by its owner", async () => {
    const alice = await withSeeds(app, 3);
    await own(app, alice.gid, 5, "plant", { type: "lavender" });

    // Bob acting on "plot 5" acts on his own garden, which is empty: Alice's is untouched.
    const bob = newVisitor(app.url);
    expect((await own(app, bob.gid, 5, "water")).status).toBe(409);
    const aliceStream = await join(app, alice.gid);
    const plots = aliceStream.frames.find((f) => f.event === "own-garden")!.data as OwnPlot[];
    expect(plots[5].plantType).toBe("lavender");
    expect(plots[5].state).not.toBe("empty");
  });

  it("logs each action and refusal with a reason, by public id", async () => {
    const alice = await withSeeds(app, 7);
    await own(app, alice.gid, 1, "plant", { type: "lavender" });
    await own(app, alice.gid, 2, "plant", { type: "tulip" });
    await own(app, alice.gid, 2, "water");

    const lines = app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=plant garden=own plot=1 type=lavender result=ok"))).toBe(true);
    expect(lines.some((l) => l.includes("did=plant garden=own plot=2 result=refused reason=unknown-type"))).toBe(true);
    expect(lines.some((l) => l.includes("did=water garden=own plot=2 result=refused reason=empty"))).toBe(true);
    expect(app.logs().some((l) => l.includes(alice.gid))).toBe(false);
  });
});

// Its own server with a short wilt window, so the other tests' plants never wilt
// before seeds are gathered from them.
describe("an own garden's plants over time", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({
      SEED_TO_SPROUT_MS: "50",
      SPROUT_TO_GROWING_MS: "50",
      GROWING_TO_MATURE_MS: "50",
      WILT_WINDOW_MS: "2500",
      SWEEP_INTERVAL_MS: "200",
    });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("grows and wilts like the shared garden: water resets the clock, and a wilted plant needs composting", { timeout: 15_000 }, async () => {
    const alice = await withSeeds(app, 1);
    const stream = await join(app, alice.gid);
    expect((await own(app, alice.gid, 0, "water")).status).toBe(409);
    await own(app, alice.gid, 0, "plant", { type: "lavender" });

    // The sweep tells the owner as it grows.
    await stream.waitFor((f) => f.event === "own-update" && (f.data as OwnPlot).state === "mature", 2000);
    expect((await own(app, alice.gid, 0, "compost")).status).toBe(409);

    await sleep(1500);
    expect((await own(app, alice.gid, 0, "water")).status).toBe(200);
    await sleep(1500);
    // Watered 1.5 s ago, so not yet wilted, though planted 3 s ago.
    expect((await own(app, alice.gid, 0, "water")).body.state).toBe("mature");

    await sleep(3000);
    expect((await own(app, alice.gid, 0, "water")).status).toBe(409);
    expect((await own(app, alice.gid, 0, "plant", { type: "lavender" })).status).toBe(409);
    expect((await own(app, alice.gid, 0, "compost")).body.state).toBe("empty");
  });

});

describe("own gardens and their limits", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({
      SEED_TO_SPROUT_MS: "50",
      SPROUT_TO_GROWING_MS: "50",
      GROWING_TO_MATURE_MS: "50",
      MAX_OWN_GARDENS: "1",
      ACTION_LIMIT: "6",
      ACTION_WINDOW_MS: "60000",
    });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("keeps only so many gardens, and counts against the same action limit", async () => {
    const alice = await withSeeds(app, 0);
    const bob = await withSeeds(app, 1);
    expect((await own(app, alice.gid, 0, "plant", { type: "lavender" })).status).toBe(200);
    const full = await own(app, bob.gid, 0, "plant", { type: "lavender" });
    expect(full.status).toBe(409);
    expect(full.body.error).toMatch(/any more gardens/);

    // Alice has used 3 of her 6 (plant, gather, own plant); three more and she is held off.
    for (let i = 0; i < 3; i++) await own(app, alice.gid, 8, "water");
    expect((await own(app, alice.gid, 8, "water")).status).toBe(429);
  });
});
