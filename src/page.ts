export function renderPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Community Garden</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="scene-container"></div>

  <aside id="panel" aria-label="Garden controls">
    <div class="panel-header">
      <h1>Community Garden</h1>
      <button type="button" id="panel-toggle" aria-expanded="true" aria-controls="panel-body">Hide</button>
    </div>
    <div id="panel-body">
      <div id="plant-picker" role="radiogroup" aria-label="Choose what to plant">
        <p class="panel-label">What to plant</p>
        <button type="button" role="radio" aria-checked="true" data-type="tree"><span class="chip chip-tree"></span>Tree</button>
        <button type="button" role="radio" aria-checked="false" data-type="flower"><span class="chip chip-flower"></span>Flower</button>
        <button type="button" role="radio" aria-checked="false" data-type="shrub"><span class="chip chip-shrub"></span>Flower shrub</button>
      </div>
      <p class="panel-help">A shared garden: anyone can plant an empty plot, and anyone can water any plot. Drag to look around and click a plot to act on it. The ring around a plant shows who watered it last, and it pulses when the plant gets thirsty.</p>
      <p class="panel-link"><a href="/readme/">About this app</a></p>
    </div>
  </aside>

  <p id="status-bar" role="status" aria-live="polite">Hover a plot to see its status. Click to act.</p>

  <script type="importmap">
  {
    "imports": {
      "three": "/vendor/three/three.module.js",
      "three/addons/": "/vendor/three/"
    }
  }
  </script>
  <script type="module" src="/app.js"></script>
</body>
</html>`;
}
