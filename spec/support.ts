import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Helpers for specs that need their own copy of the app: one with a short
// wilt window and an empty database, so rules about wilted plots can be
// checked in seconds and don't depend on whatever the shared app holds.

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// Node's fetch reuses idle keep-alive connections, and with this server a
// request on a reused connection can stall for seconds (a persistent Python
// connection and curl don't, so it's the client, not the app). That wrecks
// specs that wait out a wilt window, so every request here asks for a fresh
// connection.
const fresh = { connection: "close" };

export interface PrivateApp {
  url: string;
  stop: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}

export async function startApp(env: Record<string, string>): Promise<PrivateApp> {
  const dir = mkdtempSync(join(tmpdir(), "garden-spec-"));
  const port = await freePort();
  const child = spawn(process.execPath, [fileURLToPath(new URL("../src/server.ts", import.meta.url))], {
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: join(dir, "garden.db"),
      SWEEP_INTERVAL_MS: "60000",
      ...env,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += chunk));

  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; ; attempt++) {
    if (child.exitCode !== null) throw new Error(`private app exited early:\n${stderr}`);
    try {
      await fetch(url);
      break;
    } catch {
      // not up yet
    }
    if (attempt > 100) throw new Error(`private app never answered at ${url}:\n${stderr}`);
    await sleep(100);
  }

  return {
    url,
    stop: async () => {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface PlotView {
  position: number;
  state: string;
  plantType: string | null;
  plantedBy: string | null;
  lastWateredBy: string | null;
}

export interface Visitor {
  gid: string;
  post: (position: number, action: string, body?: unknown) => Promise<{ status: number; body: PlotView }>;
}

// A visitor is just a cookie: a fresh gid is a fresh person.
export function newVisitor(url: string): Visitor {
  const gid = randomUUID();
  return {
    gid,
    post: async (position, action, body) => {
      const res = await fetch(new URL(`/api/plots/${position}/${action}`, url), {
        method: "POST",
        headers: { cookie: `gid=${gid}`, ...fresh, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, body: (await res.json().catch(() => ({}))) as PlotView };
    },
  };
}

// The current state of every plot, as a client sees it: the first snapshot on
// /events.
export async function readPlots(url: string): Promise<PlotView[]> {
  const controller = new AbortController();
  const res = await fetch(new URL("/events", url), { signal: controller.signal, headers: fresh });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  while (!raw.includes("event: snapshot\ndata: ") || !raw.endsWith("\n\n")) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }
  controller.abort();

  const block = raw.split("\n\n").find((b) => b.startsWith("event: snapshot"))!;
  return JSON.parse(block.split("\n").find((l) => l.startsWith("data: "))!.slice("data: ".length));
}

export interface SseFrame {
  event: string;
  data: unknown;
}

export interface Stream {
  frames: SseFrame[];
  raw: () => string;
  // Resolves with the first frame, already received or still to come, that the
  // predicate accepts; rejects if none turns up in time.
  waitFor: (predicate: (frame: SseFrame) => boolean, timeoutMs?: number) => Promise<SseFrame>;
  close: () => void;
}

// A visitor who stays connected to /events and collects every frame it sends,
// for specs about things that happen over time.
export async function openStream(url: string, gid: string): Promise<Stream> {
  const controller = new AbortController();
  const res = await fetch(new URL("/events", url), {
    headers: { cookie: `gid=${gid}`, ...fresh },
    signal: controller.signal,
  });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const frames: SseFrame[] = [];
  let raw = "";
  let parsedUpTo = 0;

  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) return;
        raw += decoder.decode(value, { stream: true });
        for (;;) {
          const end = raw.indexOf("\n\n", parsedUpTo);
          if (end === -1) break;
          const block = raw.slice(parsedUpTo, end);
          parsedUpTo = end + 2;
          const event = block.split("\n").find((l) => l.startsWith("event: "))?.slice("event: ".length);
          const data = block.split("\n").find((l) => l.startsWith("data: "))?.slice("data: ".length);
          if (event !== undefined && data !== undefined) frames.push({ event, data: JSON.parse(data) });
        }
      }
    } catch {
      // closed on purpose
    }
  })();

  return {
    frames,
    raw: () => raw,
    waitFor: async (predicate, timeoutMs = 1500) => {
      const deadline = Date.now() + timeoutMs;
      for (;;) {
        const found = frames.find(predicate);
        if (found) return found;
        if (Date.now() > deadline) {
          throw new Error(`no matching frame within ${timeoutMs}ms; got: ${frames.map((f) => f.event).join(", ")}`);
        }
        await sleep(20);
      }
    },
    close: () => controller.abort(),
  };
}

// Tells the garden where a visitor's figure is and where it is going.
export async function postPresence(url: string, gid: string, body: unknown): Promise<number> {
  const res = await fetch(new URL("/api/presence", url), {
    method: "POST",
    headers: { cookie: `gid=${gid}`, "content-type": "application/json", ...fresh },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return res.status;
}
