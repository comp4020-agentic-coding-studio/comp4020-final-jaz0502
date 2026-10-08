import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { type PrivateApp, type SseFrame, type Stream, newVisitor, openStream, sleep, startApp } from "./support.ts";

// A gardener's own record of what they have planted, watered and composted. It
// is a record, not a score: it goes to that gardener and nobody else, and is never
// compared with anyone's. Each test uses a private copy of the server.
const open: Stream[] = [];
afterEach(() => {
  for (const stream of open.splice(0)) stream.close();
});

interface Stats {
  planted: number;
  watered: number;
  composted: number;
  since: number | null;
}

async function join(app: PrivateApp, gid: string): Promise<Stream> {
  const stream = await openStream(app.url, gid);
  open.push(stream);
  await stream.waitFor((f) => f.event === "stats");
  return stream;
}

const statsFrames = (stream: Stream): Stats[] =>
  stream.frames.filter((f) => f.event === "stats").map((f) => f.data as Stats);

const hasCounts = (planted: number, watered: number, composted: number) => (f: SseFrame) => {
  if (f.event !== "stats") return false;
  const stats = f.data as Stats;
  return stats.planted === planted && stats.watered === watered && stats.composted === composted;
};

describe("a gardener's record", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({ WILT_WINDOW_MS: "1500" });
  });
  afterAll(async () => {
    await app.stop();
  });

  it("counts what they plant, water and compost, and only what succeeds", { timeout: 15_000 }, async () => {
    const alice = newVisitor(app.url);
    const stream = await join(app, alice.gid);
    expect(statsFrames(stream)[0]).toEqual({ planted: 0, watered: 0, composted: 0, since: null });

    await alice.post(0, "plant");
    await alice.post(1, "plant");
    await alice.post(1, "water");
    await stream.waitFor(hasCounts(2, 1, 0));

    // A refused action counts for nothing.
    expect((await alice.post(0, "plant")).status).toBe(409);
    await sleep(200);
    expect(statsFrames(stream).at(-1)).toMatchObject({ planted: 2, watered: 1, composted: 0 });

    // Composting needs a plot that has wilted.
    await alice.post(2, "plant");
    await sleep(1800);
    expect((await alice.post(2, "compost")).status).toBe(200);
    const last = await stream.waitFor(hasCounts(3, 1, 1));
    expect(typeof (last.data as Stats).since).toBe("number");
  });

  it("has it ready the next time they connect", async () => {
    const alice = newVisitor(app.url);
    await alice.post(5, "plant");
    await alice.post(5, "water");

    const later = await join(app, alice.gid);
    expect(statsFrames(later)[0]).toMatchObject({ planted: 1, watered: 1, composted: 0 });
  });

  it("never sends one gardener's record to anyone else", async () => {
    const alice = newVisitor(app.url);
    const bobStream = await join(app, newVisitor(app.url).gid);

    await alice.post(8, "plant");
    await alice.post(8, "water");
    await sleep(400);

    // Bob gets only his own, once, on connecting.
    expect(statsFrames(bobStream)).toEqual([{ planted: 0, watered: 0, composted: 0, since: null }]);
  });
});

describe("keeping it", () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(joinPath(tmpdir(), "garden-stats-"));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("survives a restart, and is kept under the public id, not the cookie", async () => {
    const file = joinPath(dir, "garden.db");
    const first = await startApp({ DB_PATH: file });
    const alice = newVisitor(first.url);
    await alice.post(0, "plant");
    await alice.post(0, "water");
    await alice.post(1, "plant");
    const before = await join(first, alice.gid);
    await before.waitFor(hasCounts(2, 1, 0));

    // Read the table straight off the disk: one row, under the public id.
    const db = new DatabaseSync(file, { readOnly: true });
    const rows = db.prepare("SELECT * FROM gardener_stats").all() as unknown as { id: string }[];
    db.close();
    expect(rows.map((r) => r.id)).toEqual([publicId(alice.gid)]);
    expect(JSON.stringify(rows)).not.toContain(alice.gid);

    before.close();
    await first.stop();

    const second = await startApp({ DB_PATH: file });
    const after = await join(second, alice.gid);
    expect(statsFrames(after)[0]).toMatchObject({ planted: 2, watered: 1, composted: 0 });
    await second.stop();
  });
});

describe("a limit on how many gardeners are counted", () => {
  it("stops counting new gardeners past it, so the database can't grow without limit", async () => {
    const app = await startApp({ MAX_COUNTED_GARDENERS: "2" });
    try {
      const [a, b, c] = [newVisitor(app.url), newVisitor(app.url), newVisitor(app.url)];
      const streams = [await join(app, a.gid), await join(app, b.gid), await join(app, c.gid)];

      await a.post(0, "plant");
      await b.post(1, "plant");
      await c.post(2, "plant");
      await streams[0].waitFor(hasCounts(1, 0, 0));
      await streams[1].waitFor(hasCounts(1, 0, 0));

      // The third still gets their action done, but isn't counted.
      await sleep(300);
      expect(statsFrames(streams[2]).at(-1)).toMatchObject({ planted: 0, watered: 0, composted: 0 });
    } finally {
      await app.stop();
    }
  });
});
