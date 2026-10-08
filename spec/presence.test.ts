import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { type PrivateApp, type Stream, openStream, postPresence, sleep, startApp } from "./support.ts";

// Who is in the garden, and where their figure is. A private copy of the server,
// so the list is exactly the visitors a test opens. Each test closes what it
// opened, so one test's gardeners never show up in the next.
let app: PrivateApp;
beforeAll(async () => {
  app = await startApp({});
});
afterAll(async () => {
  await app.stop();
});

const open: Stream[] = [];
afterEach(() => {
  for (const stream of open.splice(0)) stream.close();
});

async function join(gid: string): Promise<Stream> {
  const stream = await openStream(app.url, gid);
  open.push(stream);
  await stream.waitFor((f) => f.event === "presence");
  return stream;
}

interface Gardener {
  id: string;
  u: number;
  target: number;
}
const isUpdateFor = (gid: string) => (f: { event: string; data: unknown }) =>
  f.event === "presence-update" && (f.data as Gardener).id === publicId(gid);
const isLeaveFor = (gid: string) => (f: { event: string; data: unknown }) =>
  f.event === "presence-leave" && (f.data as { id: string }).id === publicId(gid);

describe("who is here", () => {
  it("lists everyone already here when you join, and tells them when you arrive", async () => {
    const alice = randomUUID();
    const bob = randomUUID();
    const aliceStream = await join(alice);
    const bobStream = await join(bob);

    const list = (bobStream.frames.find((f) => f.event === "presence")!.data as Gardener[]).map((g) => g.id);
    expect(list).toContain(publicId(alice));
    expect(list).toContain(publicId(bob));

    const arrival = await aliceStream.waitFor(isUpdateFor(bob));
    expect((arrival.data as Gardener).id).toBe(publicId(bob));
  });

  it("opens with hello and the plots, then the list of gardeners", async () => {
    const stream = await join(randomUUID());
    expect(stream.frames.map((f) => f.event).slice(0, 3)).toEqual(["hello", "snapshot", "presence"]);
  });

  it("keeps a gardener until their last connection closes", async () => {
    const alice = randomUUID();
    const bobStream = await join(randomUUID());
    const first = await join(alice);
    const second = await join(alice);

    first.close();
    await sleep(300);
    expect(bobStream.frames.some(isLeaveFor(alice))).toBe(false);

    second.close();
    await bobStream.waitFor(isLeaveFor(alice));
  });

  it("never sends anyone's cookie, only public ids", async () => {
    const alice = randomUUID();
    const bob = randomUUID();
    await join(alice);
    const bobStream = await join(bob);
    expect(await postPresence(app.url, alice, { u: 0.2, target: 0.7 })).toBe(204);
    await bobStream.waitFor(isUpdateFor(alice));

    expect(bobStream.raw()).not.toContain(alice);
    expect(bobStream.raw()).not.toContain(bob);
  });
});

describe("moving", () => {
  it("passes a gardener's move on to everyone else within a second", async () => {
    const alice = randomUUID();
    await join(alice);
    const bobStream = await join(randomUUID());

    expect(await postPresence(app.url, alice, { u: 0.1, target: 0.6 })).toBe(204);
    const moved = await bobStream.waitFor(
      (f) => isUpdateFor(alice)(f) && (f.data as Gardener).target === 0.6,
      1000,
    );
    expect((moved.data as Gardener).u).toBe(0.1);
  });

  it("rejects anything that isn't two numbers from 0 up to but not including 1", async () => {
    const alice = randomUUID();
    await join(alice);

    for (const body of [
      { u: 1, target: 0.5 },
      { u: -0.1, target: 0.5 },
      { u: 0.2, target: 2 },
      { u: "0.2", target: 0.5 },
      { u: 0.2 },
      { target: 0.5 },
      {},
      null,
      [],
      "{ not json",
    ]) {
      expect(await postPresence(app.url, alice, body), JSON.stringify(body)).toBe(400);
    }
  });

  it("refuses a move from someone who isn't connected", async () => {
    expect(await postPresence(app.url, randomUUID(), { u: 0.1, target: 0.2 })).toBe(409);
  });

  it("limits how fast one gardener can move", async () => {
    const alice = randomUUID();
    await join(alice);

    expect(await postPresence(app.url, alice, { u: 0.1, target: 0.2 })).toBe(204);
    expect(await postPresence(app.url, alice, { u: 0.1, target: 0.3 })).toBe(429);

    await sleep(150);
    expect(await postPresence(app.url, alice, { u: 0.1, target: 0.4 })).toBe(204);
  });
});
