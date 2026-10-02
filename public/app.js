const STAGE_LABEL = {
  empty: "Empty plot",
  planted: "Just planted",
  sprout: "Sprouting",
  mature: "Mature",
  wilted: "Wilted — needs composting",
};

function actionFor(state) {
  if (state === "empty") return { action: "plant", label: "Plant" };
  if (state === "wilted") return { action: "compost", label: "Compost" };
  return { action: "water", label: "Water" };
}

function formatAgo(timestampMs, now) {
  const diffMs = now - timestampMs;
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Mirrors src/page.ts's plotCell markup: the server renders the first
// paint, this re-renders the same shape after every SSE event.
function renderCellBody(plot) {
  const { action, label } = actionFor(plot.state);
  const watered =
    plot.lastWateredAt === null
      ? ""
      : `<div class="plot__watered">Watered ${formatAgo(plot.lastWateredAt, Date.now())}</div>`;
  return `<div class="plot__label">${STAGE_LABEL[plot.state]}</div>
${watered}
<button type="button" data-position="${plot.position}" data-action="${action}">${label}</button>`;
}

function applyPlot(plot) {
  const el = document.getElementById(`plot-${plot.position}`);
  if (!el) return;
  el.className = `plot plot--${plot.state}`;
  el.innerHTML = renderCellBody(plot);
}

function connect() {
  const source = new EventSource("/events");
  source.addEventListener("snapshot", (event) => {
    for (const plot of JSON.parse(event.data)) applyPlot(plot);
  });
  source.addEventListener("update", (event) => {
    applyPlot(JSON.parse(event.data));
  });
}

const grid = document.getElementById("grid");
grid.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  button.disabled = true;
  try {
    const res = await fetch(`/api/plots/${button.dataset.position}/${button.dataset.action}`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.warn("action rejected", res.status, body.error);
    }
    // On success, the UI updates via the SSE `update` broadcast, not this
    // response directly.
  } finally {
    button.disabled = false;
  }
});

connect();
