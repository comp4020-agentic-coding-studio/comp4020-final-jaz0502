import type { IncomingMessage, ServerResponse } from "node:http";
import { recordActivity } from "./activity.ts";
import * as db from "./db.ts";
import { BEDS, DAY_LENGTH_MS, WILT_WINDOW_MS, bedAt, bedTakes, derivePlot, isPlantType } from "./garden.ts";
import { getOrSetIdentity, publicId } from "./identity.ts";
import { allowAction } from "./limits.ts";
import { logEvent } from "./log.ts";
import { renderPage } from "./page.ts";
import { move as moveGardener, wave as waveGardener } from "./presence.ts";
import { renderReadme } from "./readme.ts";
import { broadcastActivity, broadcastPresenceUpdate, broadcastUpdate, broadcastWave, sendOwnUpdate, sendSeeds, sendStats, subscribe } from "./realtime.ts";
import { serveStatic } from "./static.ts";
import type { PlantType, Plot } from "./types.ts";

const MAX_BODY_BYTES = 1024;

// The plant action's optional JSON body. Returns undefined for no body, and
// null for one that is too large or isn't valid JSON.
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

// Storage and the handlers below work with raw gid cookies; anything sent to
// a client goes through here first so a cookie never leaves the server.
function toPublic(plot: Plot): Plot {
  return {
    ...plot,
    plantedBy: plot.plantedBy === null ? null : publicId(plot.plantedBy),
    lastWateredBy: plot.lastWateredBy === null ? null : publicId(plot.lastWateredBy),
  };
}

// A gardener's own garden as it stands now, or null if they have none yet. Own
// plots carry no names, so there is nothing to make public.
export function derivedOwnPlots(owner: string): Plot[] | null {
  if (!db.hasOwnGarden(owner)) return null;
  const now = Date.now();
  return db.listOwnPlots(owner).map((plot) => derivePlot(plot, now));
}

function ownPlotsNow(owner: string): Plot[] {
  const now = Date.now();
  return db.listOwnPlots(owner).map((plot) => derivePlot(plot, now));
}

export function derivedPlots(): Plot[] {
  const now = Date.now();
  return db.listPlots().map((plot) => toPublic(derivePlot(plot, now)));
}

// Each returns the plot's new derived state on success, or null on a
// conflict — the caller broadcasts the success case over SSE rather than
// relying on the POST response, so every connected tab (including the
// caller's own) updates through exactly one code path.
function handlePlant(position: number, actorId: string, plantType: PlantType): Plot | null {
  const plot = db.getPlot(position);
  if (!plot) return null;
  if (derivePlot(plot, Date.now()).state !== "empty") return null;

  const updated = db.plant(position, actorId, plantType);
  return updated ? derivePlot(updated, Date.now()) : null;
}

function handleWater(position: number, actorId: string): Plot | null {
  const plot = db.getPlot(position);
  if (!plot) return null;
  const derived = derivePlot(plot, Date.now());
  if (derived.state === "empty" || derived.state === "wilted") return null;

  const updated = db.water(position, actorId);
  return updated ? derivePlot(updated, Date.now()) : null;
}

function handleCompost(position: number): Plot | null {
  const plot = db.getPlot(position);
  if (!plot) return null;
  if (derivePlot(plot, Date.now()).state !== "wilted") return null;

  const updated = db.compost(position);
  return updated ? derivePlot(updated, Date.now()) : null;
}

// Why an action was refused, for the log, read off the plot after the fact.
function refusalReason(position: number, action: "plant" | "water" | "compost"): string {
  const plot = db.getPlot(position);
  if (!plot) return "no-such-plot";
  const { state } = derivePlot(plot, Date.now());
  if (action === "plant") return "not-empty";
  if (action === "water") return state === "empty" ? "empty" : "wilted";
  return "not-wilted";
}

const ACTION_PATTERN =/^\/api\/plots\/(\d+)\/(plant|water|compost)$/;
const GATHER_PATTERN = /^\/api\/plots\/(\d+)\/gather$/;
// Your own garden. There is no way to name anyone else's: whose garden it is comes
// from the cookie alone.
const OWN_PATTERN = /^\/api\/own-garden\/(\d+)\/(plant|water|compost)$/;

const OWN_REFUSALS: Record<string, string> = {
  "unknown-type": "Unknown plant type",
  "no-seeds": "You have no seeds of that kind. Gather some from a fully grown plant.",
  "not-empty": "Something is already growing there.",
  empty: "There is nothing there to water.",
  wilted: "This plant has wilted. Compost it first.",
  "not-wilted": "Only a wilted plant can be composted.",
  "too-many-gardeners": "The garden can't keep any more gardens just now.",
};

const GATHER_REFUSALS: Record<string, string> = {
  "not-mature": "Only a fully grown plant has seeds to gather.",
  "already-gathered": "You have already gathered seeds from this plant.",
  "seeds-full": "You have as many of these seeds as you can carry.",
  "too-many-gardeners": "The garden can't keep any more seeds just now.",
};

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const identity = getOrSetIdentity(req, res);
  const url = new URL(req.url ?? "/", "http://localhost");
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderPage());
    return;
  }

  if (req.method === "GET" && pathname === "/readme/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await renderReadme());
    return;
  }

  if (req.method === "GET" && pathname === "/styles.css") {
    await serveStatic(res, "styles.css", "text/css; charset=utf-8");
    return;
  }

  if (req.method === "GET" && pathname === "/app.js") {
    await serveStatic(res, "app.js", "application/javascript; charset=utf-8");
    return;
  }

  if (req.method === "GET" && pathname === "/vendor/three/three.module.js") {
    await serveStatic(res, "vendor/three/three.module.js", "application/javascript; charset=utf-8");
    return;
  }

  // three.module.js imports everything from this sibling file in recent
  // Three.js builds.
  if (req.method === "GET" && pathname === "/vendor/three/three.core.js") {
    await serveStatic(res, "vendor/three/three.core.js", "application/javascript; charset=utf-8");
    return;
  }

  if (req.method === "GET" && pathname === "/vendor/three/controls/OrbitControls.js") {
    await serveStatic(res, "vendor/three/controls/OrbitControls.js", "application/javascript; charset=utf-8");
    return;
  }

  // The handwriting for the journal's headings, served from the repo like
  // Three.js so the page needs no third party. Its licence sits beside it.
  if (req.method === "GET" && pathname === "/vendor/fonts/caveat-latin.woff2") {
    await serveStatic(res, "vendor/fonts/caveat-latin.woff2", "font/woff2");
    return;
  }

  if (req.method === "GET" && pathname === "/events") {
    subscribe(
      res,
      derivedPlots(),
      {
        you: publicId(identity),
        wiltWindowMs: WILT_WINDOW_MS,
        dayLengthMs: DAY_LENGTH_MS,
        serverNow: Date.now(),
        beds: BEDS.map(({ name, takes }) => ({ name, takes })),
      },
      publicId(identity),
      db.getStats(publicId(identity)),
      db.getSeeds(publicId(identity)),
      ownPlotsNow(publicId(identity)),
    );
    return;
  }

  // A gardener says where their figure is and where it is walking to. Nothing
  // here limits what they can do to a plot: a figure's place is only for show.
  if (req.method === "POST" && pathname === "/api/presence") {
    const result = moveGardener(publicId(identity), await readJsonBody(req), Date.now());
    if (!result.ok) {
      const status = result.reason === "invalid" ? 400 : result.reason === "not-connected" ? 409 : 429;
      const error =
        result.reason === "invalid"
          ? "u and target must be numbers from 0 up to but not including 1"
          : result.reason === "not-connected"
            ? "Not connected: open the garden's event stream first"
            : "Too many moves: slow down";
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error }));
      return;
    }
    broadcastPresenceUpdate(result.gardener);
    res.writeHead(204);
    res.end();
    return;
  }

  // A gardener waves hello. Everyone sees it, nothing is kept or counted, and like
  // everything about a figure it limits nothing anyone can do to a plot.
  if (req.method === "POST" && pathname === "/api/wave") {
    const id = publicId(identity);
    const result = waveGardener(id, Date.now());
    if (!result.ok) {
      logEvent(id, "wave", { result: "refused", reason: result.reason });
      const status = result.reason === "not-connected" ? 409 : 429;
      const error =
        result.reason === "not-connected"
          ? "Not connected: open the garden's event stream first"
          : "Too many waves: give it a moment";
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error }));
      return;
    }
    logEvent(id, "wave", { result: "ok" });
    broadcastWave(id);
    res.writeHead(204);
    res.end();
    return;
  }

  // Gathering seeds reads a fully grown plant and changes nothing in the shared
  // garden: only the gatherer's own seeds change, and only they are told. So it is
  // never broadcast and never in Recent. It counts against the same limit.
  const gatherMatch = pathname.match(GATHER_PATTERN);
  if (req.method === "POST" && gatherMatch) {
    const position = Number(gatherMatch[1]);
    const who = publicId(identity);
    const limit = allowAction(who, Date.now());
    if (!limit.ok) {
      if (limit.firstRefusal) logEvent(who, "gather", { plot: position, result: "refused", reason: "rate-limited" });
      res.writeHead(429, {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
      });
      res.end(JSON.stringify({ error: "Slow down: too many actions, try again in a few seconds" }));
      return;
    }

    const stored = db.getPlot(position);
    const plot = stored ? derivePlot(stored, Date.now()) : undefined;
    const result =
      !plot || plot.state !== "mature" || plot.plantType === null || plot.plantedAt === null
        ? ({ ok: false, reason: plot ? "not-mature" : "no-such-plot" } as const)
        : db.gatherSeeds(who, position, plot.plantedAt, plot.plantType);

    if (result.ok) {
      logEvent(who, "gather", { plot: position, type: plot!.plantType!, seeds: result.gained, result: "ok" });
      sendSeeds(who, result.seeds);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: plot!.plantType, gained: result.gained }));
    } else {
      logEvent(who, "gather", { plot: position, result: "refused", reason: result.reason });
      res.writeHead(result.reason === "no-such-plot" ? 404 : 409, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: GATHER_REFUSALS[result.reason] ?? "There is no plot there." }));
    }
    return;
  }

  // Planting, watering and composting in your own garden. The same rules as the
  // shared garden, but only you can act here, a seed is used for each plant, and
  // only you are told: never broadcast, never in Recent and not in your record.
  const ownMatch = pathname.match(OWN_PATTERN);
  if (req.method === "POST" && ownMatch) {
    const position = Number(ownMatch[1]);
    const action = ownMatch[2] as "plant" | "water" | "compost";
    const who = publicId(identity);
    const limit = allowAction(who, Date.now());
    if (!limit.ok) {
      if (limit.firstRefusal) logEvent(who, action, { garden: "own", plot: position, result: "refused", reason: "rate-limited" });
      res.writeHead(429, {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
      });
      res.end(JSON.stringify({ error: "Slow down: too many actions, try again in a few seconds" }));
      return;
    }

    const refuse = (status: number, reason: string, type?: PlantType) => {
      logEvent(who, action, { garden: "own", plot: position, ...(type ? { type } : {}), result: "refused", reason });
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: OWN_REFUSALS[reason] ?? "There is no plot there." }));
    };

    const stored = db.getOwnPlot(who, position);
    if (!stored) return refuse(404, "no-such-plot");
    const plot = derivePlot(stored, Date.now());

    let plantType: PlantType | undefined;
    if (action === "plant") {
      const body = await readJsonBody(req);
      const requested = typeof body === "object" && body !== null ? (body as { type?: unknown }).type : undefined;
      if (!isPlantType(requested)) return refuse(400, "unknown-type");
      plantType = requested;
      if (plot.state !== "empty") return refuse(409, "not-empty", plantType);
      const planted = db.plantOwn(who, position, plantType);
      if (!planted.ok) return refuse(409, planted.reason, plantType);
      sendSeeds(who, db.getSeeds(who));
    } else if (action === "water") {
      if (plot.state === "empty" || plot.state === "wilted") return refuse(409, plot.state);
      db.waterOwn(who, position);
    } else {
      if (plot.state !== "wilted") return refuse(409, "not-wilted");
      db.compostOwn(who, position);
    }

    const updated = derivePlot(db.getOwnPlot(who, position)!, Date.now());
    logEvent(who, action, { garden: "own", plot: position, ...(plantType ? { type: plantType } : {}), result: "ok" });
    sendOwnUpdate(who, updated);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(updated));
    return;
  }

  const actionMatch = pathname.match(ACTION_PATTERN);
  if (req.method === "POST" && actionMatch) {
    const position = Number(actionMatch[1]);
    const action = actionMatch[2] as "plant" | "water" | "compost";

    // Only so many actions a moment, whatever they are: checked first, so a flood is
    // turned away before anything is read or done. It is logged once for the
    // window, so a flood cannot flood the log.
    const limit = allowAction(publicId(identity), Date.now());
    if (!limit.ok) {
      if (limit.firstRefusal) {
        logEvent(publicId(identity), action, { plot: position, result: "refused", reason: "rate-limited" });
      }
      res.writeHead(429, {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1000))),
      });
      res.end(JSON.stringify({ error: "Slow down: too many actions, try again in a few seconds" }));
      return;
    }

    // Which plant to put in: the optional body's `type`, a tree if there is none.
    let plantType: PlantType = "tree";
    if (action === "plant") {
      const body = await readJsonBody(req);
      const requested =
        body === undefined ? "tree" : typeof body === "object" && body !== null ? (body as { type?: unknown }).type ?? "tree" : null;
      if (!isPlantType(requested)) {
        logEvent(publicId(identity), "plant", { plot: position, result: "refused", reason: "unknown-type" });
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Unknown plant type" }));
        return;
      }
      plantType = requested;

      // Each bed takes only what it is for. A position that is not a plot at all
      // is left to the usual refusal below.
      const bed = bedAt(position);
      if (bed && !bedTakes(bed, plantType)) {
        logEvent(publicId(identity), "plant", {
          plot: position,
          type: plantType,
          result: "refused",
          reason: "wrong-bed",
        });
        res.writeHead(409, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: `${bed.name} only takes ${bed.takesText}.` }));
        return;
      }
    }

    const result =
      action === "plant"
        ? handlePlant(position, identity, plantType)
        : action === "water"
          ? handleWater(position, identity)
          : handleCompost(position);

    const who = publicId(identity);
    if (result) {
      logEvent(who, action, { plot: position, ...(action === "plant" ? { type: plantType } : {}), result: "ok" });
      broadcastActivity(
        recordActivity({ id: who, did: action, plot: position, ...(action === "plant" ? { type: plantType } : {}) }),
      );

      // A plain record for the one who did it, kept by public id and sent to their
      // own streams only.
      sendStats(publicId(identity), db.recordAction(publicId(identity), action, Date.now()));

      const publicResult = toPublic(result);
      broadcastUpdate(publicResult);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(publicResult));
    } else {
      logEvent(who, action, { plot: position, result: "refused", reason: refusalReason(position, action) });
      res.writeHead(409, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Conflict: action not valid for this plot's current state" }));
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}
