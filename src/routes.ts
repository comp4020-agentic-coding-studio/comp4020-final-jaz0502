import type { IncomingMessage, ServerResponse } from "node:http";
import { GRID_SIZE, derivePlot, emptyPlot } from "./garden.ts";
import { getOrSetIdentity } from "./identity.ts";
import { renderPage } from "./page.ts";
import { renderReadme } from "./readme.ts";
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

function handlePlant(position: number, actorId: string): boolean {
  const plot = findPlot(position);
  if (!plot) return false;
  if (derivePlot(plot, Date.now()).state !== "empty") return false;

  const now = Date.now();
  plot.state = "planted";
  plot.plantedAt = now;
  plot.plantedBy = actorId;
  plot.lastWateredAt = now;
  plot.lastWateredBy = actorId;
  return true;
}

function handleWater(position: number, actorId: string): boolean {
  const plot = findPlot(position);
  if (!plot) return false;
  const derived = derivePlot(plot, Date.now());
  if (derived.state === "empty" || derived.state === "wilted") return false;

  plot.lastWateredAt = Date.now();
  plot.lastWateredBy = actorId;
  return true;
}

function handleCompost(position: number): boolean {
  const plot = findPlot(position);
  if (!plot) return false;
  if (derivePlot(plot, Date.now()).state !== "wilted") return false;

  plot.state = "empty";
  plot.plantedAt = null;
  plot.plantedBy = null;
  plot.lastWateredAt = null;
  plot.lastWateredBy = null;
  return true;
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

  const actionMatch = pathname.match(ACTION_PATTERN);
  if (req.method === "POST" && actionMatch) {
    const position = Number(actionMatch[1]);
    const action = actionMatch[2] as "plant" | "water" | "compost";

    const ok =
      action === "plant"
        ? handlePlant(position, identity)
        : action === "water"
          ? handleWater(position, identity)
          : handleCompost(position);

    if (ok) {
      res.writeHead(303, { location: "/" });
      res.end();
    } else {
      res.writeHead(409, { "content-type": "text/plain" });
      res.end("Conflict: action not valid for this plot's current state");
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}
