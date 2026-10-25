import { readFile } from "node:fs/promises";
import { marked } from "marked";

const README_PATH = new URL("../README.md", import.meta.url);

// The README on the same aged paper as the garden's panels, in a readable column.
// Only the look is added here: the words are the README's own.
const STYLE = `
  @font-face {
    font-family: "Caveat";
    src: url("/vendor/fonts/caveat-latin.woff2") format("woff2");
    font-weight: 400 700;
    font-display: swap;
  }

  :root {
    --paper: #ebdcb2;
    --ink: #3b2c1a;
    --moss: #4a6a35;
    --rule: #a98a55;
    color-scheme: light;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 1.5rem 1rem 3rem;
    color: var(--ink);
    background:
      radial-gradient(ellipse at 50% 0%, rgba(255, 244, 205, 0.5), transparent 60%),
      #6f8f55;
    font: 1.05rem/1.65 Georgia, "Iowan Old Style", "Palatino Linotype", serif;
  }

  .page {
    max-width: 42rem;
    margin: 0 auto;
    padding: 1.2rem clamp(1.1rem, 5vw, 2.6rem) 2.2rem;
    background:
      radial-gradient(ellipse at 14% 96%, rgba(150, 100, 40, 0.22), transparent 40%),
      radial-gradient(ellipse at 94% 4%, rgba(150, 100, 40, 0.18), transparent 32%),
      radial-gradient(ellipse at 50% 50%, rgba(255, 244, 205, 0.5), transparent 70%),
      var(--paper);
    border: 1px solid var(--rule);
    border-radius: 5px 13px 7px 15px / 13px 6px 15px 5px;
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25), inset 0 0 40px rgba(150, 100, 40, 0.35);
  }

  .back {
    display: inline-block;
    margin-bottom: 0.4rem;
    padding: 0.2rem 0.9rem;
    color: #fff;
    background: var(--moss);
    border-radius: 999px;
    font: 700 1.2rem/1.5 "Caveat", "Segoe Print", "Bradley Hand", cursive;
    text-decoration: none;
  }

  .back:hover,
  .back:focus-visible { background: #3b5529; }

  h1, h2 {
    margin: 1.4rem 0 0.5rem;
    color: var(--moss);
    font-family: "Caveat", "Segoe Print", "Bradley Hand", cursive;
    font-weight: 700;
    line-height: 1.1;
  }

  h1 { margin-top: 0.2rem; font-size: 3rem; }

  h2 {
    padding-bottom: 0.3rem;
    font-size: 2.1rem;
    border-bottom: 2px dashed rgba(74, 106, 53, 0.45);
  }

  p, ul { margin: 0.7rem 0; }
  ul { padding-left: 1.3rem; }
  li { margin: 0.45rem 0; }
  li::marker { color: var(--moss); }

  a { color: #6b4a1e; text-underline-offset: 3px; }
  a:hover { color: var(--moss); }

  code {
    padding: 0.05em 0.35em;
    background: rgba(120, 88, 45, 0.14);
    border-radius: 4px;
    font-size: 0.9em;
    overflow-wrap: anywhere;
  }

  pre {
    overflow-x: auto;
    padding: 0.8rem 1rem;
    background: rgba(120, 88, 45, 0.14);
    border-radius: 6px;
  }

  pre code { padding: 0; background: none; }
`;

export async function renderReadme(): Promise<string> {
  const source = await readFile(README_PATH, "utf8");
  const body = await marked.parse(source);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>About — Community Garden</title>
  <style>${STYLE}</style>
</head>
<body>
<main class="page">
<a class="back" href="/">Back to the garden</a>
${body}
</main>
</body>
</html>`;
}
