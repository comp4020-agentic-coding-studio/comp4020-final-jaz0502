import type { ServerResponse } from "node:http";
import { type Activity, recentActivity } from "./activity.ts";
import type { GardenerStats, Seeds } from "./db.ts";
import type { DecorationState } from "./decorations.ts";
import { logEvent } from "./log.ts";
import { type Gardener, connect, disconnect, listGardeners } from "./presence.ts";
import type { PlantType, Plot, PlotState } from "./types.ts";

// Sent once, first, on connect. `you` is the viewer's own public id so the
// client can tell which plots they tended without any per-client payloads;
// wiltWindowMs and serverNow let the client compute thirst on the server's
// clock.
export interface Hello {
  you: string;
  wiltWindowMs: number;
  dayLengthMs: number;
  serverNow: number;
  // Each bed's name and what it takes (null for any plant), in plot order.
  beds: { name: string; takes: readonly PlantType[] | null }[];
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
  | { type: "wave"; id: string }
  // Your own record of what you have done. Sent to that gardener's streams only,
  // never broadcast: nobody else is ever shown your counts.
  | { type: "stats"; stats: GardenerStats }
  // The seeds you have gathered for your own garden. Like the record, sent to your
  // own streams only.
  | { type: "seeds"; seeds: Seeds }
  // Your own garden's plots: all of them on connect, then each one that changes.
  // Sent to your own streams only, and nobody else is ever told about it.
  // The decorations you have unlocked, how many waterings until the next, and what you
  // have put where. Sent to your own streams only, never broadcast.
  | { type: "decorations"; decorations: DecorationState }
  | { type: "own-garden"; plots: Plot[] }
  | { type: "own-update"; plot: Plot }
  // What gardeners have just done: the short recent list once on connect, then each
  // new action as it happens. Public ids only.
  | { type: "feed"; feed: Activity[] }
  | { type: "activity"; activity: Activity };

// Env-overridable (short in tests) so growth/wilt transitions reach idle-but
// -open tabs without anyone acting. This is purely a liveliness convenience,
// never a source of truth: storage and every direct read still derive state
// from timestamps on demand regardless of whether this has run recently.
const SWEEP_INTERVAL_MS = Number(process.env.SWEEP_INTERVAL_MS ?? 30_000);

const clients = new Set<ServerResponse>();

// Which gardener each open stream belongs to, so something meant for one person
// can be sent to their streams alone.
const gardenerOf = new Map<ServerResponse, string>();

// The last state each connected set of clients was actually sent, so the
// sweep can broadcast only plots whose derived state changed since the last
// time anyone was told, instead of re-sending all 25 every tick.
const lastKnownState = new Map<number, PlotState>();

// The same for each connected gardener's own garden, keyed by "owner:position".
const ownKnownState = new Map<string, PlotState>();

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
    case "stats":
      return event.stats;
    case "seeds":
      return event.seeds;
    case "decorations":
      return event.decorations;
    case "own-garden":
      return event.plots;
    case "own-update":
      return event.plot;
    case "feed":
      return event.feed;
    case "activity":
      return event.activity;
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
  stats: GardenerStats,
  seeds: Seeds,
  ownPlots: Plot[],
  decorations: DecorationState,
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
  if (arrived) {
    broadcast({ type: "presence-update", gardener: arrived });
    logEvent(gardenerId, "join", { gardeners: listGardeners().length });
  }

  clients.add(res);
  gardenerOf.set(res, gardenerId);
  for (const plot of initialSnapshot) lastKnownState.set(plot.position, plot.state);
  write(res, { type: "hello", hello });
  write(res, { type: "snapshot", plots: initialSnapshot });
  write(res, { type: "presence", gardeners: listGardeners() });
  write(res, { type: "stats", stats });
  write(res, { type: "seeds", seeds });
  write(res, { type: "decorations", decorations });
  write(res, { type: "own-garden", plots: ownPlots });
  for (const plot of ownPlots) ownKnownState.set(`${gardenerId}:${plot.position}`, plot.state);
  write(res, { type: "feed", feed: recentActivity() });

  res.on("close", () => {
    clients.delete(res);
    gardenerOf.delete(res);
    if (disconnect(gardenerId)) {
      for (const key of ownKnownState.keys()) if (key.startsWith(`${gardenerId}:`)) ownKnownState.delete(key);
      broadcast({ type: "presence-leave", id: gardenerId });
      logEvent(gardenerId, "leave", { gardeners: listGardeners().length });
    }
  });
}

export function broadcastUpdate(plot: Plot): void {
  lastKnownState.set(plot.position, plot.state);
  broadcast({ type: "update", plot });
}

export function broadcastPresenceUpdate(gardener: Gardener): void {
  broadcast({ type: "presence-update", gardener });
}

// Send a gardener their own record, to every stream they have open and to no one
// else's.
export function sendStats(gardenerId: string, stats: GardenerStats): void {
  for (const [res, id] of gardenerOf) {
    if (id === gardenerId) write(res, { type: "stats", stats });
  }
}

// Send a gardener their seeds, to their own streams and no one else's.
export function sendSeeds(gardenerId: string, seeds: Seeds): void {
  for (const [res, id] of gardenerOf) {
    if (id === gardenerId) write(res, { type: "seeds", seeds });
  }
}

// Send a gardener their decorations, to their own streams and no one else's.
export function sendDecorations(gardenerId: string, decorations: DecorationState): void {
  for (const [res, id] of gardenerOf) {
    if (id === gardenerId) write(res, { type: "decorations", decorations });
  }
}

// Send one of a gardener's own plots to their own streams, and no one else's.
export function sendOwnUpdate(gardenerId: string, plot: Plot): void {
  ownKnownState.set(`${gardenerId}:${plot.position}`, plot.state);
  for (const [res, id] of gardenerOf) {
    if (id === gardenerId) write(res, { type: "own-update", plot });
  }
}

export function broadcastActivity(activity: Activity): void {
  broadcast({ type: "activity", activity });
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
// Each connected gardener's own garden is swept too, and a change goes to their own
// streams only.
export function startSweep(getDerivedPlots: () => Plot[], getOwnPlots: (owner: string) => Plot[] | null): void {
  setInterval(() => {
    if (clients.size === 0) return;
    for (const plot of getDerivedPlots()) {
      if (lastKnownState.get(plot.position) !== plot.state) {
        broadcastUpdate(plot);
      }
    }
    for (const owner of new Set(gardenerOf.values())) {
      for (const plot of getOwnPlots(owner) ?? []) {
        if (ownKnownState.get(`${owner}:${plot.position}`) !== plot.state) sendOwnUpdate(owner, plot);
      }
    }
  }, SWEEP_INTERVAL_MS).unref();
}
