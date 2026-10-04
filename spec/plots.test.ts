import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { type PrivateApp, newVisitor, readPlots, sleep, startApp } from "./support.ts";

// The garden's rules: who can plant, water and compost what, and when.
// Each test uses its own plot so they don't depend on each other. These run
// against a private copy of the server with a short wilt window and an empty
// database (see spec/support.ts), so the wilted-plot rules can be checked in
// seconds instead of 18 hours.
const WILT_MS = 2000;

let app: PrivateApp;
beforeAll(async () => {
  app = await startApp({ WILT_WINDOW_MS: String(WILT_MS) });
});
afterAll(async () => {
  await app.stop();
});

const plotAt = async (position: number) => (await readPlots(app.url)).find((p) => p.position === position)!;

describe("planting", () => {
  it("plants an empty plot and records who planted it", async () => {
    const alice = newVisitor(app.url);
    const { status, body } = await alice.post(0, "plant");
    expect(status).toBe(200);
    expect(body.state).toBe("planted");
    expect(body.plantedBy).toBe(publicId(alice.gid));
    expect(body.lastWateredBy).toBe(publicId(alice.gid));
  });

  it("refuses to plant a plot that already has a plant, and leaves it untouched", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    expect((await alice.post(1, "plant")).status).toBe(200);

    expect((await bob.post(1, "plant")).status).toBe(409);
    expect((await plotAt(1)).plantedBy).toBe(publicId(alice.gid));
  });

  it("lets only one of two simultaneous plants win", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    const results = await Promise.all([alice.post(2, "plant"), bob.post(2, "plant")]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  });

  it("rejects a position outside the bed", async () => {
    const { status } = await newVisitor(app.url).post(25, "plant");
    expect(status).toBeGreaterThanOrEqual(400);
    expect(status).toBeLessThan(500);
  });

  it("doesn't know any action other than plant, water and compost", async () => {
    expect((await newVisitor(app.url).post(3, "uproot")).status).toBe(404);
  });
});

describe("watering", () => {
  it("refuses to water an empty plot", async () => {
    expect((await newVisitor(app.url).post(10, "water")).status).toBe(409);
  });

  it("lets anyone water any plot, not just their own", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    await alice.post(4, "plant");

    const { status, body } = await bob.post(4, "water");
    expect(status).toBe(200);
    expect(body.lastWateredBy).toBe(publicId(bob.gid));
    expect(body.plantedBy).toBe(publicId(alice.gid));
  });

  it("resets the wilt clock, so a watered plant outlives the unwatered window", { timeout: 10_000 }, async () => {
    const alice = newVisitor(app.url);
    await alice.post(5, "plant");

    await sleep(WILT_MS * 0.6);
    expect((await alice.post(5, "water")).status).toBe(200);

    // Now more than a full window since planting, but well under one since
    // the watering: it must still be alive.
    await sleep(WILT_MS * 0.6);
    expect((await alice.post(5, "water")).status).toBe(200);
  });
});

describe("composting", () => {
  it("refuses to compost an empty plot", async () => {
    expect((await newVisitor(app.url).post(11, "compost")).status).toBe(409);
  });

  it("refuses to compost a plant that is still alive", async () => {
    const alice = newVisitor(app.url);
    await alice.post(6, "plant");

    expect((await alice.post(6, "compost")).status).toBe(409);
    expect((await plotAt(6)).state).toBe("planted");
  });

  it(
    "leaves a wilted plot unwaterable and unplantable until someone composts it",
    { timeout: 10_000 },
    async () => {
      const alice = newVisitor(app.url);
      const bob = newVisitor(app.url);
      await alice.post(7, "plant");

      await sleep(WILT_MS + 300);
      expect((await plotAt(7)).state).toBe("wilted");

      expect((await bob.post(7, "water")).status).toBe(409);
      expect((await bob.post(7, "plant")).status).toBe(409);

      const composted = await bob.post(7, "compost");
      expect(composted.status).toBe(200);
      expect(composted.body.state).toBe("empty");
      expect(composted.body.plantedBy).toBeNull();

      expect((await bob.post(7, "plant")).status).toBe(200);
    },
  );
});
