import type { Plot, PlotState } from "./types.ts";

const STAGE_LABEL: Record<PlotState, string> = {
  empty: "Empty plot",
  planted: "Just planted",
  sprout: "Sprouting",
  mature: "Mature",
  wilted: "Wilted — needs composting",
};

function actionForm(position: number, action: string, label: string): string {
  return `<form method="post" action="/api/plots/${position}/${action}"><button type="submit">${label}</button></form>`;
}

function plotCell(plot: Plot): string {
  const action =
    plot.state === "empty"
      ? actionForm(plot.position, "plant", "Plant")
      : plot.state === "wilted"
        ? actionForm(plot.position, "compost", "Compost")
        : actionForm(plot.position, "water", "Water");

  return `<div class="plot plot--${plot.state}">
  <div class="plot__label">${STAGE_LABEL[plot.state]}</div>
  ${action}
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
  <div class="grid">
    ${cells}
  </div>
  <p><a href="/readme/">About this app</a></p>
</body>
</html>`;
}
