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

  <div id="panels">
  <aside id="panel" class="panel" aria-label="Garden controls">
    <div class="panel-header">
      <h1>Community Garden</h1>
      <button type="button" id="panel-toggle" class="panel-toggle" aria-expanded="true" aria-controls="panel-body">Hide</button>
    </div>
    <div id="panel-body" class="panel-body">
      <p id="bed-here" class="bed-here"></p>
      <div id="plant-picker" role="radiogroup" aria-label="Choose what to plant">
        <p class="panel-label">What to plant</p>
        <button type="button" role="radio" aria-checked="true" data-type="tree"><span class="chip chip-tree"></span>Apple tree</button>
        <button type="button" role="radio" aria-checked="false" data-type="flower"><span class="chip chip-flower"></span>Tulip</button>
        <button type="button" role="radio" aria-checked="false" data-type="sunflower"><span class="chip chip-sunflower"></span>Sunflower</button>
        <button type="button" role="radio" aria-checked="false" data-type="shrub"><span class="chip chip-shrub"></span>Flower shrub</button>
        <button type="button" role="radio" aria-checked="false" data-type="vegetable"><span class="chip chip-vegetable"></span>Carrot</button>
        <button type="button" role="radio" aria-checked="false" data-type="tomato"><span class="chip chip-tomato"></span>Tomato</button>
        <button type="button" role="radio" aria-checked="false" data-type="lettuce"><span class="chip chip-lettuce"></span>Lettuce</button>
        <button type="button" role="radio" aria-checked="false" data-type="strawberry"><span class="chip chip-strawberry"></span>Strawberry</button>
        <button type="button" role="radio" aria-checked="false" data-type="blueberry"><span class="chip chip-blueberry"></span>Blueberry</button>
      </div>
      <div id="who-is-here">
        <p class="panel-label">Who's here</p>
        <div id="who-dots"></div>
        <p id="who-count">Just you here</p>
      </div>
      <details class="panel-details">
        <summary>How it works</summary>
        <p class="panel-help">A shared garden: anyone can plant an empty plot, and anyone can water any plot. Drag to look around and click a plot to act on it. The ring around a plant shows who watered it last, and it pulses when the plant gets thirsty.</p>
      </details>
      <p class="panel-link"><a href="/readme/">About this app</a></p>
    </div>
  </aside>

  <aside id="feed-panel" class="panel" aria-label="Recent activity">
    <div class="panel-header">
      <h2>Recent</h2>
      <button type="button" id="feed-toggle" class="panel-toggle" aria-expanded="true" aria-controls="feed-body">Hide</button>
    </div>
    <div id="feed-body" class="panel-body">
      <ul id="feed-list" aria-live="polite"></ul>
      <p id="feed-empty" class="feed-empty">Nothing yet. Plant something to start.</p>
    </div>
  </aside>

  <aside id="gardener-panel" class="panel" aria-label="You, the gardener">
    <div class="panel-header">
      <h2>You</h2>
      <button type="button" id="gardener-toggle" class="panel-toggle" aria-expanded="true" aria-controls="gardener-body">Hide</button>
    </div>
    <div id="gardener-body" class="panel-body">
      <div class="you-row">
        <span id="you-chip" class="you-chip"></span>
        <div>
          <p class="you-name">Gardener</p>
          <p id="you-since" class="you-since">Your record starts with your first action</p>
        </div>
      </div>
      <div class="you-record-head">
        <p class="panel-label you-label">Your record</p>
        <button type="button" id="wave-button" aria-label="Wave hello to everyone in the garden">Wave</button>
      </div>
      <dl id="you-counts">
        <div><dt>Planted</dt><dd id="count-planted">0</dd></div>
        <div><dt>Watered</dt><dd id="count-watered">0</dd></div>
        <div><dt>Composted</dt><dd id="count-composted">0</dd></div>
      </dl>
    </div>
  </aside>
  </div>

  <button type="button" id="bed-sign" class="bed-sign" hidden>
    <span class="bed-sign-label"></span>
  </button>

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
