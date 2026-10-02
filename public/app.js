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

// Mirrors src/page.ts's plotCell markup: the server renders the first
// paint, this re-renders the same shape after every SSE event.
function renderCellBody(plot) {
  const { action, label } = actionFor(plot.state);
  return `<div class="plot__label">${STAGE_LABEL[plot.state]}</div>
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
