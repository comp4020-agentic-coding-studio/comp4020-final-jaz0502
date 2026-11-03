import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { fresh, newVisitor, openStream, plantFor, sleep, startApp, type PrivateApp, type Stream, NO_PLANT_LIMIT } from "./support.ts";

// A pet for your own garden, the reward after the last decoration. It is private: only
// the gardener who earned it is told, its name is stranger-typed text so the server
// checks it, and the name is never written to the log. Each test uses a private copy of
// the server where every counting watering unlocks the next decoration, so eight
// waterings unlock them all, and a plot rests 400 ms before another watering counts.
const open: Stream[] = [];
afterEach(() => {
  for (const stream of open.splice(0)) stream.close();
});

interface PetState {
  unlocked: boolean;
  pet: { kind: string; name: string } | null;
}

const GAP = 400;
const env = { DECORATION_EVERY: "1", DECORATION_GAP_MS: String(GAP), ACTION_LIMIT: "1000", ...NO_PLANT_LIMIT };

async function join(app: PrivateApp, gid: string): Promise<Stream> {
  const stream = await openStream(app.url, gid);
  open.push(stream);
  await stream.waitFor((f) => f.event === "pet");
  return stream;
}

const frames = (stream: Stream): PetState[] => stream.frames.filter((f) => f.event === "pet").map((f) => f.data as PetState);

async function adopt(app: PrivateApp, gid: string, body: unknown) {
  const res = await fetch(new URL("/api/own-garden/pet", app.url), {
    method: "POST",
    headers: { cookie: `gid=${gid}`, "content-type": "application/json", ...fresh },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as PetState & { error?: string } };
}

// Waters eight plots that have rested, so all eight decorations unlock and a pet with them.
async function unlockPet(app: PrivateApp, visitor: ReturnType<typeof newVisitor>, stream: Stream, firstPlot: number) {
  const plots = Array.from({ length: 8 }, (_, i) => firstPlot + i);
  for (const plot of plots) await visitor.post(plot, "plant", { type: plantFor(plot) });
  await sleep(GAP + 100);
  for (const plot of plots) await visitor.post(plot, "water");
  await stream.waitFor((f) => f.event === "pet" && (f.data as PetState).unlocked);
}

describe("a pet for your own garden", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp(env);
  });
  afterAll(async () => {
    await app.stop();
  });

  it("is locked at first, and a request for one is turned away and logged", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    expect(frames(stream)).toEqual([{ unlocked: false, pet: null }]);

    const refused = await adopt(app, alice.gid, { kind: "cat", name: "Mochi" });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/haven't unlocked/);
    await app.settled();
    const lines = app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=pet kind=cat result=refused reason=locked"))).toBe(true);
  });

  it("tells the page which kinds there are", async () => {
    const stream = await join(app, newVisitor(app.url).gid);
    const hello = stream.frames.find((f) => f.event === "hello")!.data as { pets: string[] };
    expect(hello.pets).toEqual(["cat", "dog", "rabbit"]);
  });

  it("unlocks after the last decoration, and lets you adopt, rename and change kind", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    await unlockPet(app, alice, stream, 0);

    expect((await adopt(app, alice.gid, { kind: "cat", name: "Mochi" })).body.pet).toEqual({ kind: "cat", name: "Mochi" });
    await stream.waitFor((f) => f.event === "pet" && (f.data as PetState).pet?.name === "Mochi");
    expect((await adopt(app, alice.gid, { kind: "rabbit", name: "Clover2" })).body.pet).toEqual({ kind: "rabbit", name: "Clover2" });

    // It is kept: a new stream is told about it, and it is never taken back.
    const again = await join(app, alice.gid);
    expect(frames(again)).toEqual([{ unlocked: true, pet: { kind: "rabbit", name: "Clover2" } }]);
  });

  it("turns away a kind or name that is not allowed, and never keeps it", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    await unlockPet(app, alice, stream, 10);

    expect((await adopt(app, alice.gid, { kind: "dragon", name: "Mochi" })).status).toBe(400);
    expect((await adopt(app, alice.gid, { name: "Mochi" })).status).toBe(400);
    for (const name of ["", "Thirteenchars", "two words", "a=b", "a\nb", "<b>", "café", "\u{1F431}", "a-b", 7, null]) {
      expect((await adopt(app, alice.gid, { kind: "cat", name })).status, JSON.stringify(name)).toBe(400);
    }
    expect((await adopt(app, alice.gid, "not an object")).status).toBe(400);
    expect(frames(await join(app, alice.gid))).toEqual([{ unlocked: true, pet: null }]);
  });

  it("tells only its owner, never anyone else, and never carries the cookie", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    const bobStream = await join(app, bob.gid);
    await unlockPet(app, alice, stream, 20);
    await adopt(app, alice.gid, { kind: "dog", name: "Biscuit" });
    await stream.waitFor((f) => f.event === "pet" && (f.data as PetState).pet?.name === "Biscuit");
    await sleep(300);

    expect(frames(bobStream)).toEqual([{ unlocked: false, pet: null }]);
    expect(bobStream.raw()).not.toContain("Biscuit");
    expect(bobStream.frames.some((f) => f.event === "activity" && (f.data as { did: string }).did === "pet")).toBe(false);
    expect(stream.raw()).not.toContain(alice.gid);

    // Nor is it in what a stranger is sent when they open the garden.
    const stranger = await join(app, newVisitor(app.url).gid);
    expect(stranger.raw()).not.toContain("Biscuit");
  });

  it("logs that a pet was adopted by public id, but never its name or the cookie", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    await unlockPet(app, alice, stream, 30);
    await adopt(app, alice.gid, { kind: "cat", name: "Zorbaxx" });
    await adopt(app, alice.gid, { kind: "cat", name: "bad name" });
    await app.settled();

    const lines = app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=pet kind=cat result=ok"))).toBe(true);
    expect(lines.some((l) => l.includes("did=pet kind=cat result=refused reason=bad-name"))).toBe(true);
    expect(app.logs().some((l) => l.includes("Zorbaxx") || l.includes("bad name"))).toBe(false);
    expect(app.logs().some((l) => l.includes(alice.gid))).toBe(false);
  });
});

describe("a pet and the action limit", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({ ...env, ACTION_LIMIT: "3", ACTION_WINDOW_MS: "60000" });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("counts against the same budget as planting, watering and composting", async () => {
    const alice = newVisitor(app.url);
    for (let i = 0; i < 3; i++) expect((await adopt(app, alice.gid, { kind: "cat", name: "Mochi" })).status).toBe(409);
    expect((await adopt(app, alice.gid, { kind: "cat", name: "Mochi" })).status).toBe(429);
    expect((await alice.post(0, "plant", { type: plantFor(0) })).status).toBe(429);
  });
});

describe("how many pets are kept", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({ ...env, MAX_PET_KEEPERS: "1" });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("stops keeping new pets past the cap, but never takes one back", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    const aliceStream = await join(app, alice.gid);
    const bobStream = await join(app, bob.gid);
    await unlockPet(app, alice, aliceStream, 0);
    await unlockPet(app, bob, bobStream, 10);

    expect((await adopt(app, alice.gid, { kind: "cat", name: "Mochi" })).status).toBe(200);
    const full = await adopt(app, bob.gid, { kind: "dog", name: "Biscuit" });
    expect(full.status).toBe(409);
    expect(full.body.error).toMatch(/can't keep any more pets/);
    // Alice can still rename hers.
    expect((await adopt(app, alice.gid, { kind: "cat", name: "Mochi2" })).status).toBe(200);
  });
});
