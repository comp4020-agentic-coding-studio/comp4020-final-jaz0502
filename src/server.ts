import { createServer } from "node:http";
import { startSweep } from "./realtime.ts";
import { derivedPlots, handleRequest } from "./routes.ts";

const port = Number(process.env.PORT ?? 8080);

startSweep(derivedPlots);

const server = createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    console.error(err);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "text/plain" });
    }
    res.end("Internal server error");
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Listening on http://0.0.0.0:${port}`);
});
