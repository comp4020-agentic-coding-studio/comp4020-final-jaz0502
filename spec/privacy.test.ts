import { randomUUID } from "node:crypto";
import { expect, inject, it } from "vitest";
import { publicId } from "../src/identity.ts";

// The gid cookie is a visitor's whole identity, so it must never be sent to
// anyone else: clients only ever see a one-way public id. These run against the
// RUNNING app like the invariants do.
const baseUrl = inject("baseUrl");

interface SseFrame {
  event: string;
  data: unknown;
}

// Reads /events as the given visitor until the snapshot has arrived, then
// closes the stream. Returns the raw text too, so a leak anywhere in it fails.
async function readEvents(gid: string): Promise<{ raw: string; frames: SseFrame[] }> {
  const controller = new AbortController();
  const res = await fetch(new URL("/events", baseUrl), {
    headers: { cookie: `gid=${gid}` },
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  while (!raw.includes("event: snapshot\ndata: ") || !raw.endsWith("\n\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  controller.abort();

  const frames = raw
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const event = lines.find((l) => l.startsWith("event: "))!.slice("event: ".length);
      const data = JSON.parse(lines.find((l) => l.startsWith("data: "))!.slice("data: ".length));
      return { event, data };
    });
  return { raw, frames };
}

interface Plot {
  position: number;
  state: string;
  lastWateredBy: string | null;
}

// Gets the visitor's own id onto a plot. The garden is shared and long-lived,
// so rather than assume a free plot: plant the first empty one, and if the
// garden is full, water one that's growing.
async function tendAPlot(gid: string, snapshot: Plot[], raw: { body: string }): Promise<number> {
  const post = (position: number, action: string) =>
    fetch(new URL(`/api/plots/${position}/${action}`, baseUrl), {
      method: "POST",
      headers: { cookie: `gid=${gid}` },
    });

  for (const plot of snapshot.filter((p) => p.state === "empty")) {
    const res = await post(plot.position, "plant");
    if (res.ok) {
      raw.body = await res.text();
      return plot.position;
    }
  }
  for (const plot of snapshot.filter((p) => p.state !== "empty" && p.state !== "wilted")) {
    const res = await post(plot.position, "water");
    if (res.ok) {
      raw.body = await res.text();
      return plot.position;
    }
  }
  throw new Error("couldn't plant or water any plot to test with");
}

it("publicId is stable per gid and differs between gids", () => {
  const a = randomUUID();
  const b = randomUUID();
  expect(publicId(a)).toBe(publicId(a));
  expect(publicId(a)).not.toBe(publicId(b));
  expect(publicId(a)).toMatch(/^[0-9a-f]{8}$/);
  expect(publicId(a)).not.toContain(a);
});

it("never sends a visitor's gid cookie to anyone, only their public id", async () => {
  const gid = randomUUID();

  const before = await readEvents(gid);
  const snapshotBefore = before.frames.find((f) => f.event === "snapshot")!.data as Plot[];
  const action = { body: "" };
  const position = await tendAPlot(gid, snapshotBefore, action);

  // The action's own response must not leak it either.
  expect(action.body).not.toContain(gid);

  // A different visitor reads the garden afterwards.
  const observer = await readEvents(randomUUID());
  expect(observer.raw).not.toContain(gid);

  const plot = (observer.frames.find((f) => f.event === "snapshot")!.data as Plot[]).find(
    (p) => p.position === position,
  )!;
  expect(plot.lastWateredBy).toBe(publicId(gid));
  expect(plot.lastWateredBy).toMatch(/^[0-9a-f]{8}$/);

  // The tender's own connection says who "you" is, and it matches the plot.
  const mine = await readEvents(gid);
  expect(mine.frames[0].event).toBe("hello");
  expect((mine.frames[0].data as { you: string }).you).toBe(publicId(gid));
});
