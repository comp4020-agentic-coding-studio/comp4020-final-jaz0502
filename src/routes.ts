import type { IncomingMessage, ServerResponse } from "node:http";
import { GRID_SIZE, derivePlot, emptyPlot } from "./garden.ts";
import { getOrSetIdentity } from "./identity.ts";
import { renderPage } from "./page.ts";
import { renderReadme } from "./readme.ts";
import { broadcastUpdate, subscribe } from "./realtime.ts";
import { serveStatic } from "./static.ts";
import type { Plot } from "./types.ts";

// Milestone-1 scaffolding: an in-memory store standing in for the database.
// Replaced by src/db.ts (SQLite on the Fly volume) in the persistence step —
// nothing here should be relied on surviving a process restart yet.
const plots: Plot[] = Array.from({ length: GRID_SIZE }, (_, i) => emptyPlot(i));

function derivedPlots(): Plot[] {
  const now = Date.now();
  return plots.map((plot) => derivePlot(plot, now));
}

function findPlot(position: number): Plot | undefined {
  return plots.find((plot) => plot.position === position);
}

// Each returns the plot's new derived state on success, or null on a
// conflict — the caller broadcasts the success case over SSE rather than
// relying on the POST response, so every connected tab (including the
// caller's own) updates through exactly one code path.
function handlePlant(position: number, actorId: string): Plot | null {
  const plot = findPlot(position);
  if (!plot) return null;
  if (derivePlot(plot, Date.now()).state !== "empty") return null;

  const now = Date.now();
  plot.state = "planted";
  plot.plantedAt = now;
  plot.plantedBy = actorId;
  plot.lastWateredAt = now;
  plot.lastWateredBy = actorId;
  return derivePlot(plot, Date.now());
}

function handleWater(position: number, actorId: string): Plot | null {
  const plot = findPlot(position);
  if (!plot) return null;
  const derived = derivePlot(plot, Date.now());
  if (derived.state === "empty" || derived.state === "wilted") return null;

  plot.lastWateredAt = Date.now();
  plot.lastWateredBy = actorId;
  return derivePlot(plot, Date.now());
}

function handleCompost(position: number): Plot | null {
  const plot = findPlot(position);
  if (!plot) return null;
  if (derivePlot(plot, Date.now()).state !== "wilted") return null;

  plot.state = "empty";
  plot.plantedAt = null;
  plot.plantedBy = null;
  plot.lastWateredAt = null;
  plot.lastWateredBy = null;
  return derivePlot(plot, Date.now());
}

const ACTION_PATTERN = /^\/api\/plots\/(\d+)\/(plant|water|compost)$/;

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const identity = getOrSetIdentity(req, res);
  const url = new URL(req.url ?? "/", "http://localhost");
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(renderPage(derivedPlots()));
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

  if (req.method === "GET" && pathname === "/events") {
    subscribe(res, derivedPlots());
    return;
  }

  const actionMatch = pathname.match(ACTION_PATTERN);
  if (req.method === "POST" && actionMatch) {
    const position = Number(actionMatch[1]);
    const action = actionMatch[2] as "plant" | "water" | "compost";

    const result =
      action === "plant"
        ? handlePlant(position, identity)
        : action === "water"
          ? handleWater(position, identity)
          : handleCompost(position);

    if (result) {
      broadcastUpdate(result);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(result));
    } else {
      res.writeHead(409, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Conflict: action not valid for this plot's current state" }));
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}
