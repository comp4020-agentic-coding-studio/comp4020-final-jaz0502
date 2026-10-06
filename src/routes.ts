import type { IncomingMessage, ServerResponse } from "node:http";
import * as db from "./db.ts";
import { DAY_LENGTH_MS, WILT_WINDOW_MS, derivePlot, isPlantType } from "./garden.ts";
import { getOrSetIdentity, publicId } from "./identity.ts";
import { renderPage } from "./page.ts";
import { renderReadme } from "./readme.ts";
import { broadcastUpdate, subscribe } from "./realtime.ts";
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

const ACTION_PATTERN = /^\/api\/plots\/(\d+)\/(plant|water|compost)$/;

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

  if (req.method === "GET" && pathname === "/events") {
    subscribe(res, derivedPlots(), {
      you: publicId(identity),
      wiltWindowMs: WILT_WINDOW_MS,
      dayLengthMs: DAY_LENGTH_MS,
      serverNow: Date.now(),
    });
    return;
  }

  const actionMatch = pathname.match(ACTION_PATTERN);
  if (req.method === "POST" && actionMatch) {
    const position = Number(actionMatch[1]);
    const action = actionMatch[2] as "plant" | "water" | "compost";

    // Which plant to put in: the optional body's `type`, a tree if there is none.
    let plantType: PlantType = "tree";
    if (action === "plant") {
      const body = await readJsonBody(req);
      const requested =
        body === undefined ? "tree" : typeof body === "object" && body !== null ? (body as { type?: unknown }).type ?? "tree" : null;
      if (!isPlantType(requested)) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Unknown plant type" }));
        return;
      }
      plantType = requested;
    }

    const result =
      action === "plant"
        ? handlePlant(position, identity, plantType)
        : action === "water"
          ? handleWater(position, identity)
          : handleCompost(position);

    if (result) {
      const publicResult = toPublic(result);
      broadcastUpdate(publicResult);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(publicResult));
    } else {
      res.writeHead(409, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Conflict: action not valid for this plot's current state" }));
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}
