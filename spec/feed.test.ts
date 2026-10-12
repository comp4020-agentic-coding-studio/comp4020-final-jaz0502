import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { type PrivateApp, type Stream, newVisitor, openStream, postWave, sleep, startApp } from "./support.ts";

// A short list of what gardeners have just done. It is a glance at what just
// happened, not a history or a tally. Each test uses its own private copy of the
// server, because the list is kept in the server's memory.
interface Entry {
  id: string;
  did: string;
  plot: number;
  type?: string;
}

let app: PrivateApp;
const open: Stream[] = [];
beforeEach(async () => {
  app = await startApp({ WILT_WINDOW_MS: "1500" });
});
afterEach(async () => {
  for (const stream of open.splice(0)) stream.close();
  await app.stop();
});

async function join(gid: string): Promise<Stream> {
  const stream = await openStream(app.url, gid);
  open.push(stream);
  await stream.waitFor((f) => f.event === "feed");
  return stream;
}

const activities = (stream: Stream): Entry[] =>
  stream.frames.filter((f) => f.event === "activity").map((f) => f.data as Entry);

describe("the recent feed", () => {
  it("tells everyone what a gardener did, naming them by public id", async () => {
    const alice = newVisitor(app.url);
    const bobStream = await join(newVisitor(app.url).gid);

    await alice.post(4, "plant", { type: "flower" });
    await alice.post(4, "water");

    await bobStream.waitFor((f) => f.event === "activity" && (f.data as Entry).did === "water");
    expect(activities(bobStream)).toEqual([
      { id: publicId(alice.gid), did: "plant", plot: 4, type: "flower" },
      { id: publicId(alice.gid), did: "water", plot: 4 },
    ]);
  });

  it("includes composting, which stores no one's name on the plot", { timeout: 15_000 }, async () => {
    const alice = newVisitor(app.url);
    const bobStream = await join(newVisitor(app.url).gid);

    await alice.post(6, "plant");
    await sleep(1800);
    expect((await alice.post(6, "compost")).status).toBe(200);

    const frame = await bobStream.waitFor((f) => f.event === "activity" && (f.data as Entry).did === "compost");
    expect(frame.data).toEqual({ id: publicId(alice.gid), did: "compost", plot: 6 });
  });

  it("gives a newcomer only the few most recent, newest first", async () => {
    const alice = newVisitor(app.url);
    for (let plot = 0; plot < 10; plot++) await alice.post(plot, "plant");

    const late = await join(newVisitor(app.url).gid);
    const feed = late.frames.find((f) => f.event === "feed")!.data as Entry[];
    expect(feed.map((e) => e.plot)).toEqual([9, 8, 7, 6, 5, 4, 3, 2]);
  });

  it("leaves out what was refused, and waves", async () => {
    const alice = newVisitor(app.url);
    const stream = await join(alice.gid);

    await alice.post(1, "plant");
    await alice.post(1, "plant"); // already taken
    await alice.post(2, "water"); // nothing there
    expect(await postWave(app.url, alice.gid)).toBe(204);
    await sleep(300);

    expect(activities(stream).map((e) => e.did)).toEqual(["plant"]);
  });

  it("never carries the cookie", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    const stream = await join(bob.gid);

    await alice.post(0, "plant");
    await alice.post(0, "water");
    await sleep(300);
    const late = await join(newVisitor(app.url).gid);

    for (const raw of [stream.raw(), late.raw()]) {
      expect(raw).not.toContain(alice.gid);
      expect(raw).not.toContain(bob.gid);
    }
    expect(late.raw()).toContain(publicId(alice.gid));
  });
});
