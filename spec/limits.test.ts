import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { newVisitor, plantFor, readPlots, sleep, startApp, type PrivateApp, NO_PLANT_LIMIT } from "./support.ts";

// How often one gardener may act on a plot: a budget in a window of time, checked
// on the server and counted per person. A private server with a small budget and a
// short window, so it can be tried in a moment.
const LIMIT = 5;
const WINDOW_MS = 1500;

let app: PrivateApp;
beforeAll(async () => {
  app = await startApp({ ACTION_LIMIT: String(LIMIT), ACTION_WINDOW_MS: String(WINDOW_MS), WILT_WINDOW_MS: "1000000", ...NO_PLANT_LIMIT });
});
afterAll(async () => {
  await app.stop();
});

const statuses = async (visitor: ReturnType<typeof newVisitor>, plots: number[]) => {
  const out: number[] = [];
  for (const plot of plots) out.push((await visitor.post(plot, "plant", { type: plantFor(plot) })).status);
  return out;
};

describe("the limit on plot actions", () => {
  it("lets a person act up to the budget, then turns the rest away and changes nothing", async () => {
    const alice = newVisitor(app.url);
    const results = await statuses(alice, [0, 1, 2, 3, 4, 5, 6, 7]);
    expect(results).toEqual([200, 200, 200, 200, 200, 429, 429, 429]);

    const planted = (await readPlots(app.url)).filter((p) => p.state !== "empty").map((p) => p.position);
    expect(planted).toEqual([0, 1, 2, 3, 4]);
  });

  it("says why, in words a person can read", async () => {
    const alice = newVisitor(app.url);
    await statuses(alice, [10, 11, 12, 13, 14]);
    const refused = await alice.post(15, "plant", { type: plantFor(15) });
    expect(refused.status).toBe(429);
    expect((refused.body as unknown as { error: string }).error).toMatch(/slow down/i);
  });

  it("tells the browser when to try again, so it can wait instead of asking", async () => {
    const alice = newVisitor(app.url);
    await statuses(alice, [16, 17, 18, 19, 21]);
    const res = await fetch(new URL("/api/plots/22/plant", app.url), {
      method: "POST",
      headers: { cookie: `gid=${alice.gid}`, connection: "close" },
    });
    expect(res.status).toBe(429);
    const seconds = Number(res.headers.get("retry-after"));
    expect(Number.isInteger(seconds)).toBe(true);
    expect(seconds).toBeGreaterThanOrEqual(1);
    expect(seconds).toBeLessThanOrEqual(Math.ceil(WINDOW_MS / 1000));
  });

  it("counts refused attempts too, so hammering a plot you can't act on is stopped", async () => {
    const alice = newVisitor(app.url);
    await alice.post(20, "plant", { type: plantFor(20) });
    for (let i = 0; i < 4; i++) expect((await alice.post(20, "plant", { type: plantFor(20) })).status).toBe(409);
    // Five attempts so far, all counted: the sixth is turned away, not refused as a conflict.
    expect((await alice.post(20, "plant", { type: plantFor(20) })).status).toBe(429);
  });

  it("lets a person act again once the window has passed", { timeout: 15_000 }, async () => {
    const alice = newVisitor(app.url);
    await statuses(alice, [5, 6, 7, 8, 9]);
    expect((await alice.post(24, "plant", { type: plantFor(24) })).status).toBe(429);

    await sleep(WINDOW_MS + 300);
    expect((await alice.post(24, "plant", { type: plantFor(24) })).status).toBe(200);
  });

  it("is each person's own: one person's flood never stops another", async () => {
    const flooder = newVisitor(app.url);
    const other = newVisitor(app.url);
    await statuses(flooder, [0, 1, 2, 3, 4, 22, 23]);
    expect((await flooder.post(21, "plant", { type: plantFor(21) })).status).toBe(429);

    expect((await other.post(70, "plant", { type: plantFor(70) })).status).toBe(200);
  });

  it("covers water and compost as well as plant", async () => {
    const alice = newVisitor(app.url);
    await alice.post(50, "plant", { type: plantFor(50) });
    for (let i = 0; i < 4; i++) await alice.post(50, "water");
    expect((await alice.post(50, "water")).status).toBe(429);
    expect((await alice.post(50, "compost")).status).toBe(429);
  });
});

describe("what the limit writes to the log", () => {
  it("logs a flood once, not once for every attempt, and never the cookie", async () => {
    const alice = newVisitor(app.url);
    await statuses(alice, [60, 61, 62, 63, 64, 65, 66, 67, 68, 69]);

    const limited = app.logs().filter((l) => l.startsWith(`who=${publicId(alice.gid)} `) && l.includes("reason=rate-limited"));
    expect(limited).toHaveLength(1);
    expect(limited[0]).toContain("result=refused");
    expect(app.logs().join("\n")).not.toContain(alice.gid);
  });
});
