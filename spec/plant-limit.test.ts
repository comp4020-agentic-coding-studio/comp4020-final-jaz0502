import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { newVisitor, plantFor, readPlots, sleep, startApp, type PrivateApp } from "./support.ts";

// How much one person may plant in the shared garden: so many plantings in a rolling
// window of time, and only so many of those in one bed, so nobody takes over a bed
// or the garden. A private server with a small allowance and a short window, so it
// can be tried in a moment. The action limit is set high so it never gets in the way.
const TOTAL = 4;
const PER_BED = 2;
const WINDOW_MS = 2500;

let app: PrivateApp;
beforeAll(async () => {
  app = await startApp({
    PLANT_LIMIT: String(TOTAL),
    PLANT_BED_LIMIT: String(PER_BED),
    PLANT_WINDOW_MS: String(WINDOW_MS),
    ACTION_LIMIT: "1000",
    WILT_WINDOW_MS: "1000000",
  });
});
afterAll(async () => {
  await app.stop();
});

const plant = (visitor: ReturnType<typeof newVisitor>, plot: number) =>
  visitor.post(plot, "plant", { type: plantFor(plot) });

describe("the limit on planting", () => {
  it("lets a person plant only so much in one bed, and says which bed", async () => {
    const alice = newVisitor(app.url);
    expect((await plant(alice, 0)).status).toBe(200);
    expect((await plant(alice, 1)).status).toBe(200);
    const refused = await plant(alice, 2);
    expect(refused.status).toBe(409);
    expect((refused.body as unknown as { error: string }).error).toMatch(/The Cottage Garden/);
    // Nothing was planted in the refused plot, and another bed is still open to her.
    expect((await readPlots(app.url))[2].state).toBe("empty");
    expect((await plant(alice, 30)).status).toBe(200);
  });

  it("lets a person plant only so much in all, whichever beds", async () => {
    const alice = newVisitor(app.url);
    for (const plot of [5, 6, 30 + 5, 30 + 6]) expect((await plant(alice, plot)).status).toBe(200);
    const refused = await plant(alice, 55);
    expect(refused.status).toBe(409);
    expect((refused.body as unknown as { error: string }).error).toMatch(/as much as you can for now/);
    expect((await readPlots(app.url))[55].state).toBe("empty");
  });

  it("is each person's own: one person's planting never stops another", async () => {
    const alice = newVisitor(app.url);
    const bob = newVisitor(app.url);
    for (const plot of [10, 11, 12]) await plant(alice, plot);
    expect((await plant(alice, 13)).status).toBe(409);
    expect((await plant(bob, 13)).status).toBe(200);
  });

  it("comes back as the window passes, and only watering and composting are not limited", { timeout: 15_000 }, async () => {
    const alice = newVisitor(app.url);
    await plant(alice, 15);
    await plant(alice, 16);
    expect((await plant(alice, 17)).status).toBe(409);
    // Watering is not planting: it is not held back.
    expect((await alice.post(15, "water")).status).toBe(200);

    await sleep(WINDOW_MS + 300);
    expect((await plant(alice, 17)).status).toBe(200);
  });

  it("counts only what was planted: a refused planting costs nothing", async () => {
    const alice = newVisitor(app.url);
    await plant(alice, 20);
    // Planting on a taken plot is refused, and must not use up the allowance.
    for (let i = 0; i < 5; i++) expect((await plant(alice, 20)).status).toBe(409);
    expect((await plant(alice, 21)).status).toBe(200);
  });

  it("does not hold back planting in your own garden", async () => {
    // The shared limit is about the shared garden. Own plots are limited by seeds.
    const alice = newVisitor(app.url);
    const own = await fetch(new URL("/api/own-garden/0/plant", app.url), {
      method: "POST",
      headers: { cookie: `gid=${alice.gid}`, "content-type": "application/json", connection: "close" },
      body: JSON.stringify({ type: "lavender" }),
    });
    // Refused for having no seeds, not for the planting limit.
    expect(own.status).toBe(409);
    expect(((await own.json()) as { error: string }).error).toMatch(/no seeds/);
  });

  it("logs a refusal with its reason and the public id, never the cookie", async () => {
    const alice = newVisitor(app.url);
    for (const plot of [40, 41]) await plant(alice, plot);
    await plant(alice, 42);
    for (const plot of [70, 71]) await plant(alice, plot);
    await plant(alice, 90);

    const lines = app.logs().filter((l) => l.includes(`who=${publicId(alice.gid)} `));
    expect(lines.some((l) => l.includes("did=plant plot=42") && l.includes("result=refused reason=bed-limit"))).toBe(true);
    expect(lines.some((l) => l.includes("did=plant plot=90") && l.includes("result=refused reason=plant-limit"))).toBe(true);
    expect(app.logs().some((l) => l.includes(alice.gid))).toBe(false);
  });
});
