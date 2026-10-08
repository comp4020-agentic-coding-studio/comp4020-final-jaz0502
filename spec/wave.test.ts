import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { type PrivateApp, type SseFrame, type Stream, openStream, postPresence, postWave, sleep, startApp } from "./support.ts";

// Waves: a hello to everyone in the garden. Nothing about a wave is stored,
// counted or ranked, and it limits nothing anyone can do to a plot. A private
// copy of the server, so the gardeners are exactly the visitors a test opens.
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

const isWaveFrom = (gid: string) => (f: SseFrame) =>
  f.event === "wave" && (f.data as { id: string }).id === publicId(gid);

describe("waving", () => {
  it("shows a wave to everyone in the garden, including the one who waved", async () => {
    const alice = randomUUID();
    const aliceStream = await join(alice);
    const bobStream = await join(randomUUID());

    expect(await postWave(app.url, alice)).toBe(204);

    await bobStream.waitFor(isWaveFrom(alice), 1000);
    await aliceStream.waitFor(isWaveFrom(alice), 1000);
  });

  it("refuses a wave from someone who isn't in the garden", async () => {
    expect(await postWave(app.url, randomUUID())).toBe(409);
  });

  it("limits how often one gardener can wave", async () => {
    const alice = randomUUID();
    await join(alice);

    expect(await postWave(app.url, alice)).toBe(204);
    expect(await postWave(app.url, alice)).toBe(429);

    await sleep(1600);
    expect(await postWave(app.url, alice)).toBe(204);
  });

  it("only sends who waved, never anyone's cookie", async () => {
    const alice = randomUUID();
    const bob = randomUUID();
    await join(alice);
    const bobStream = await join(bob);

    expect(await postWave(app.url, alice)).toBe(204);
    await bobStream.waitFor(isWaveFrom(alice));

    expect(bobStream.raw()).not.toContain(alice);
    expect(bobStream.raw()).not.toContain(bob);
  });

  it("leaves where the gardener's figure is alone", async () => {
    const alice = randomUUID();
    await join(alice);
    const bobStream = await join(randomUUID());
    expect(await postPresence(app.url, alice, { u: 0.2, target: 0.7 })).toBe(204);
    await bobStream.waitFor((f) => f.event === "presence-update" && (f.data as { id: string }).id === publicId(alice));

    const before = bobStream.frames.length;
    expect(await postWave(app.url, alice)).toBe(204);
    await bobStream.waitFor(isWaveFrom(alice));
    await sleep(200);

    const after = bobStream.frames.slice(before);
    expect(after.map((f) => f.event)).toEqual(["wave"]);
  });
});
