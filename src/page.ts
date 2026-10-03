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
  <p>A shared, cooperative garden bed. Anyone can plant an empty plot, and anyone can water any growing plot &mdash; there's no ownership here. Drag to look around, click a plot to act on it.</p>
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
