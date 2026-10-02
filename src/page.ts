import type { Plot, PlotState } from "./types.ts";

const STAGE_LABEL: Record<PlotState, string> = {
  empty: "Empty plot",
  planted: "Just planted",
  sprout: "Sprouting",
  mature: "Mature",
  wilted: "Wilted — needs composting",
};

function actionFor(state: PlotState): { action: string; label: string } {
  if (state === "empty") return { action: "plant", label: "Plant" };
  if (state === "wilted") return { action: "compost", label: "Compost" };
  return { action: "water", label: "Water" };
}

// Visible feedback for watering: it doesn't change the stage label by
// itself (it only resets the wilt clock), so without this a click looked
// like it did nothing.
function formatAgo(timestampMs: number, now: number): string {
  const diffMs = now - timestampMs;
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Kept in sync with public/app.js's renderCell: the server renders the
// initial page, the client re-renders the same markup after each SSE event.
function plotCell(plot: Plot): string {
  const { action, label } = actionFor(plot.state);
  const watered =
    plot.lastWateredAt === null
      ? ""
      : `<div class="plot__watered">Watered ${formatAgo(plot.lastWateredAt, Date.now())}</div>`;
  return `<div class="plot plot--${plot.state}" id="plot-${plot.position}">
  <div class="plot__label">${STAGE_LABEL[plot.state]}</div>
  ${watered}
  <button type="button" data-position="${plot.position}" data-action="${action}">${label}</button>
</div>`;
}

export function renderPage(plots: Plot[]): string {
  const cells = plots.map(plotCell).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Community Garden</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <h1>Community Garden</h1>
  <p>A shared, cooperative garden bed. Anyone can plant an empty plot, and anyone can water any growing plot &mdash; there's no ownership here.</p>
  <div class="grid" id="grid">
${cells}
  </div>
  <p><a href="/readme/">About this app</a></p>
  <script src="/app.js" defer></script>
</body>
</html>`;
}
