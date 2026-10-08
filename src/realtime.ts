import type { ServerResponse } from "node:http";
import { type Gardener, connect, disconnect, listGardeners } from "./presence.ts";
import type { Plot, PlotState } from "./types.ts";

// Sent once, first, on connect. `you` is the viewer's own public id so the
// client can tell which plots they tended without any per-client payloads;
// wiltWindowMs and serverNow let the client compute thirst on the server's
// clock.
export interface Hello {
  you: string;
  wiltWindowMs: number;
  dayLengthMs: number;
  serverNow: number;
}

type SseEvent =
  | { type: "hello"; hello: Hello }
  | { type: "snapshot"; plots: Plot[] }
  | { type: "update"; plot: Plot }
  // Who is in the garden: the whole list once on connect, then one gardener
  // arriving or moving, or leaving. Public ids only.
  | { type: "presence"; gardeners: Gardener[] }
  | { type: "presence-update"; gardener: Gardener }
  | { type: "presence-leave"; id: string }
  // A gardener waved. Only who, and only for everyone to see: it is not stored.
  | { type: "wave"; id: string };

// Env-overridable (short in tests) so growth/wilt transitions reach idle-but
// -open tabs without anyone acting. This is purely a liveliness convenience,
// never a source of truth: storage and every direct read still derive state
// from timestamps on demand regardless of whether this has run recently.
const SWEEP_INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS ?? 30_000);

const clients = new Set<ServerResponse>();

// The last state each connected set of clients was actually sent, so the
// sweep can broadcast only plots whose derived state changed since the last
// time anyone was told, instead of re-sending all 25 every tick.
const lastKnownState = new Map<number, PlotState>();

function payloadOf(event: SseEvent): unknown {
  switch (event.type) {
    case "hello":
      return event.hello;
    case "snapshot":
      return event.plots;
    case "update":
      return event.plot;
    case "presence":
      return event.gardeners;
    case "presence-update":
      return event.gardener;
    case "presence-leave":
      return { id: event.id };
    case "wave":
      return { id: event.id };
  }
}

function write(res: ServerResponse, event: SseEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(payloadOf(event))}\n\n`);
}

function broadcast(event: SseEvent): void {
  for (const res of clients) write(res, event);
}

// Opens a long-lived SSE stream: sends the current state once as a
// `snapshot`, then stays registered to receive `update` broadcasts. The
// browser's EventSource reconnects on its own after a dropped connection
// (e.g. the Fly machine stopping when idle), so no client-side retry logic
// is needed.
export function subscribe(
  res: ServerResponse,
  initialSnapshot: Plot[],
  hello: Hello,
  gardenerId: string,
): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });

  // Tell everyone already here that a new gardener has arrived, before this
  // connection joins the list, so they aren't told about themselves twice. A
  // second tab from someone already here isn't an arrival.
  const arrived = connect(gardenerId);
  if (arrived) broadcast({ type: "presence-update", gardener: arrived });

  clients.add(res);
  for (const plot of initialSnapshot) lastKnownState.set(plot.position, plot.state);
  write(res, { type: "hello", hello });
  write(res, { type: "snapshot", plots: initialSnapshot });
  write(res, { type: "presence", gardeners: listGardeners() });

  res.on("close", () => {
    clients.delete(res);
    if (disconnect(gardenerId)) broadcast({ type: "presence-leave", id: gardenerId });
  });
}

export function broadcastUpdate(plot: Plot): void {
  lastKnownState.set(plot.position, plot.state);
  broadcast({ type: "update", plot });
}

export function broadcastPresenceUpdate(gardener: Gardener): void {
  broadcast({ type: "presence-update", gardener });
}

export function broadcastWave(id: string): void {
  broadcast({ type: "wave", id });
}

export function clientCount(): number {
  return clients.size;
}

// Re-derives every plot on an interval and broadcasts only the ones whose
// state changed, so a tab left open sees a plant sprout or wilt without
// anyone clicking. Skips entirely while nobody's connected — there's no
// ticking clock running when the app is otherwise idle or stopped.
export function startSweep(getDerivedPlots: () => Plot[]): void {
  setInterval(() => {
    if (clients.size === 0) return;
    for (const plot of getDerivedPlots()) {
      if (lastKnownState.get(plot.position) !== plot.state) {
        broadcastUpdate(plot);
      }
    }
  }, SWEEP_INTERVAL_MS).unref();
}
