import type { ServerResponse } from "node:http";
import type { Plot } from "./types.ts";

type SseEvent = { type: "snapshot"; plots: Plot[] } | { type: "update"; plot: Plot };

const clients = new Set<ServerResponse>();

function write(res: ServerResponse, event: SseEvent): void {
  const data = JSON.stringify(event.type === "snapshot" ? event.plots : event.plot);
  res.write(`event: ${event.type}\ndata: ${data}\n\n`);
}

// Opens a long-lived SSE stream: sends the current state once as a
// `snapshot`, then stays registered to receive `update` broadcasts. The
// browser's EventSource reconnects on its own after a dropped connection
// (e.g. the Fly machine stopping when idle), so no client-side retry logic
// is needed.
export function subscribe(res: ServerResponse, initialSnapshot: Plot[]): void {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache",
    connection: "keep-alive",
  });
  clients.add(res);
  write(res, { type: "snapshot", plots: initialSnapshot });
  res.on("close", () => clients.delete(res));
}

export function broadcastUpdate(plot: Plot): void {
  for (const res of clients) write(res, { type: "update", plot });
}

export function clientCount(): number {
  return clients.size;
}
