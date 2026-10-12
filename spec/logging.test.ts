import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { type PrivateApp, newVisitor, openStream, postPresence, postWave, sleep, startApp } from "./support.ts";

// The server says what each gardener did, one line each, so someone watching
// `flyctl logs` can follow the garden. The lines name the public id and never the
// cookie. Each test file uses a private copy of the server.
describe("the server's log", () => {
  let app: PrivateApp;
  beforeAll(async () => {
    app = await startApp({ WILT_WINDOW_MS: "60000" });
  });
  afterAll(async () => {
    await app.stop();
  });

  const linesFor = (id: string) => app.logs().filter((line) => line.startsWith(`who=${id} `));

  it("says who planted, watered and composted, and where", async () => {
    const alice = newVisitor(app.url);
    const id = publicId(alice.gid);

    await alice.post(0, "plant", { type: "flower" });
    await alice.post(0, "water");

    const lines = linesFor(id);
    expect(lines).toContain(`who=${id} hue=${parseInt(id.slice(0, 6), 16) % 360} did=plant plot=0 type=flower result=ok`);
    expect(lines.some((l) => l.includes("did=water plot=0 result=ok"))).toBe(true);
  });

  it("says why an action was refused", async () => {
    const alice = newVisitor(app.url);
    const id = publicId(alice.gid);

    await alice.post(1, "water"); // nothing planted
    await alice.post(2, "plant");
    await alice.post(2, "plant"); // already taken
    await alice.post(2, "compost"); // not wilted
    await alice.post(3, "plant", { type: "cactus" }); // not a plant type

    const lines = linesFor(id);
    const has = (text: string) => lines.some((l) => l.includes(text));
    expect(has("did=water plot=1 result=refused reason=empty")).toBe(true);
    expect(has("did=plant plot=2 result=refused reason=not-empty")).toBe(true);
    expect(has("did=compost plot=2 result=refused reason=not-wilted")).toBe(true);
    expect(has("did=plant plot=3 result=refused reason=unknown-type")).toBe(true);
  });

  it("says who waved, and when a wave was turned away", async () => {
    const alice = newVisitor(app.url);
    const id = publicId(alice.gid);
    const stream = await openStream(app.url, alice.gid);
    try {
      await stream.waitFor((f) => f.event === "presence");
      expect(await postWave(app.url, alice.gid)).toBe(204);
      expect(await postWave(app.url, alice.gid)).toBe(429);
    } finally {
      stream.close();
    }

    const lines = linesFor(id);
    expect(lines.some((l) => l.includes("did=wave result=ok"))).toBe(true);
    expect(lines.some((l) => l.includes("did=wave result=refused reason=too-fast"))).toBe(true);
  });

  it("does not log a figure walking about", async () => {
    const alice = newVisitor(app.url);
    const stream = await openStream(app.url, alice.gid);
    try {
      await stream.waitFor((f) => f.event === "presence");
      const before = app.logs().length;
      for (let i = 0; i < 5; i++) {
        await postPresence(app.url, alice.gid, { u: i / 10, target: 0.5 });
        await sleep(120);
      }
      expect(app.logs().length).toBe(before);
    } finally {
      stream.close();
    }
  });

  it("says when a gardener joins and leaves, and not for a second tab", async () => {
    const alice = newVisitor(app.url);
    const id = publicId(alice.gid);
    const did = (what: string) => linesFor(id).filter((l) => new RegExp(`did=${what}(\\s|$)`).test(l));

    const first = await openStream(app.url, alice.gid);
    await first.waitFor((f) => f.event === "presence");
    const second = await openStream(app.url, alice.gid);
    await second.waitFor((f) => f.event === "presence");
    expect(did("join")).toHaveLength(1);
    expect(did("join")[0]).toMatch(/gardeners=\d+$/);

    // Closing one of two tabs is not leaving.
    first.close();
    await sleep(300);
    expect(did("leave")).toHaveLength(0);

    second.close();
    await sleep(300);
    expect(did("leave")).toHaveLength(1);
  });

  it("never writes the cookie, only the public id", async () => {
    const visitors = [newVisitor(app.url), newVisitor(app.url)];
    for (const [i, v] of visitors.entries()) {
      await v.post(10 + i, "plant");
      await v.post(10 + i, "water");
      await v.post(10 + i, "compost");
    }

    const everything = app.logs().join("\n");
    for (const v of visitors) {
      expect(everything).not.toContain(v.gid);
      expect(everything).toContain(`who=${publicId(v.gid)} `);
    }
  });
});
