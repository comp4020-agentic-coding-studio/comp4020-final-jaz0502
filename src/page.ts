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
  <h1>Community Garden</h1>
  <p>A shared, cooperative garden bed. Anyone can plant an empty plot, and anyone can water any growing plot &mdash; there's no ownership here. Drag to look around, click a plot to act on it. The ring around each plant shows who watered it last, and it fades and pulses as the plant gets thirsty.</p>
  <div id="plant-picker" role="radiogroup" aria-label="Choose what to plant">
    <span class="picker-label">Plant:</span>
    <button type="button" role="radio" aria-checked="true" data-type="tree">Tree</button>
    <button type="button" role="radio" aria-checked="false" data-type="flower">Flower</button>
    <button type="button" role="radio" aria-checked="false" data-type="shrub">Flower shrub</button>
  </div>
  <div id="scene-container"></div>
  <p id="status-bar" role="status" aria-live="polite">Hover a plot to see its status. Click to act.</p>
  <p><a href="/readme/">About this app</a></p>
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
