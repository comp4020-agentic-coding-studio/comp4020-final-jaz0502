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
        <button type="button" role="radio" aria-checked="false" data-type="lavender"><span class="chip chip-lavender"></span>Lavender</button>
        <button type="button" role="radio" aria-checked="false" data-type="rosemary"><span class="chip chip-rosemary"></span>Rosemary</button>
        <button type="button" role="radio" aria-checked="false" data-type="foxglove"><span class="chip chip-foxglove"></span>Foxglove</button>
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
        <div class="you-actions">
          <button type="button" id="camera-button" aria-label="Take a photo of the garden">Camera</button>
          <button type="button" id="wave-button" aria-label="Wave hello to everyone in the garden">Wave</button>
        </div>
      </div>
      <dl id="you-counts">
        <div><dt>Planted</dt><dd id="count-planted">0</dd></div>
        <div><dt>Watered</dt><dd id="count-watered">0</dd></div>
        <div><dt>Composted</dt><dd id="count-composted">0</dd></div>
      </dl>
      <details id="album" class="panel-details">
        <summary>Album</summary>
        <p id="album-note" class="panel-help">Photos you take are kept in this browser only. Nobody else sees them.</p>
        <div id="album-grid" role="list"></div>
      </details>
    </div>
  </aside>
  </div>

  <button type="button" id="bed-sign" class="bed-sign" hidden>
    <span class="bed-sign-label"></span>
  </button>

  <div id="photo-ui" hidden>
    <div id="photo-frame" role="group" aria-label="Photo frame" tabindex="0">
      <span class="photo-handle" data-corner="nw"></span>
      <span class="photo-handle" data-corner="ne"></span>
      <span class="photo-handle" data-corner="sw"></span>
      <span class="photo-handle" data-corner="se"></span>
    </div>
    <p id="photo-hint"><span class="hint-long">Drag the frame to move it, drag a corner or pinch to resize it. Drag outside it to turn the view. With the keyboard: arrows move it, Shift and arrows resize it, Enter takes the photo.</span><span class="hint-short">Drag to move, pinch or drag a corner to resize.</span></p>
    <div id="photo-bar" role="toolbar" aria-label="Photo options">
      <div id="photo-shapes" role="radiogroup" aria-label="Shape of the photo">
        <button type="button" role="radio" aria-checked="false" data-shape="free">Free</button>
        <button type="button" role="radio" aria-checked="true" data-shape="wide">Wide</button>
        <button type="button" role="radio" aria-checked="false" data-shape="square">Square</button>
        <button type="button" role="radio" aria-checked="false" data-shape="portrait">Portrait</button>
      </div>
      <button type="button" id="photo-shutter" aria-label="Take the photo">Take photo</button>
      <button type="button" id="photo-close">Close</button>
    </div>
    <div id="photo-flash"></div>
    <div id="photo-preview" role="dialog" aria-label="Your photo" hidden>
      <img id="photo-preview-img" alt="The photo you just took">
      <div class="photo-preview-actions">
        <button type="button" id="photo-retake">Retake</button>
        <button type="button" id="photo-save">Save to album</button>
        <button type="button" id="photo-download">Save to device</button>
        <button type="button" id="photo-done">Done</button>
      </div>
      <p id="photo-note" role="status"></p>
    </div>
  </div>

  <div id="album-view" role="dialog" aria-label="A photo from your album" hidden>
    <img id="album-view-img" alt="A photo from your album">
    <div class="photo-preview-actions">
      <button type="button" id="album-save">Save to device</button>
      <button type="button" id="album-delete">Delete</button>
      <button type="button" id="album-close">Close</button>
    </div>
  </div>

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
