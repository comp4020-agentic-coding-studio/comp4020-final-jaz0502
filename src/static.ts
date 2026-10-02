import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";

const PUBLIC_DIR = new URL("../public/", import.meta.url);

export async function serveStatic(
  res: ServerResponse,
  filename: string,
  contentType: string,
): Promise<void> {
  try {
    const data = await readFile(new URL(filename, PUBLIC_DIR));
    res.writeHead(200, { "content-type": contentType });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("Not found");
  }
}
