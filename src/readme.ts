import { readFile } from "node:fs/promises";
import { marked } from "marked";

const README_PATH = new URL("../README.md", import.meta.url);

export async function renderReadme(): Promise<string> {
  const source = await readFile(README_PATH, "utf8");
  const body = await marked.parse(source);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>About — Community Garden</title>
</head>
<body>
${body}
</body>
</html>`;
}
