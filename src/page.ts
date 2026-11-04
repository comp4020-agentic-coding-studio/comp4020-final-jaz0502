import { SEED_SPRITE } from "./seed-art.ts";

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
  ${SEED_SPRITE}
  <div id="scene-container"></div>

  <div id="panels">
  <aside id="panel" class="panel paper" aria-label="Garden controls">
    <svg class="sprig" viewBox="0 0 70 46" aria-hidden="true" focusable="false">
      <path class="vine-stem s2" d="M2 6 C 14 4, 24 14, 36 12 C 46 10, 52 18, 60 16"/>
      <path class="vine-stem s3" d="M36 12 C 38 22, 34 30, 38 38"/>
      <path class="vine-tendril" d="M24 11 C 24 20, 32 22, 32 16"/>
      <path class="sprig-leaf l1" d="M14 8 c -2 -8 -11 -9 -13 -3 c 4 6 10 8 13 3 z"/>
      <path class="sprig-leaf l2" d="M26 12 c 3 7 11 8 14 2 c -5 -5 -11 -6 -14 -2 z"/>
      <path class="sprig-leaf l3" d="M48 12 c -1 -8 -9 -10 -13 -5 c 3 6 9 8 13 5 z"/>
      <path class="sprig-leaf l1" d="M38 30 c 6 -3 11 1 10 6 c -5 2 -10 0 -10 -6 z"/>
      <use href="#vine-bud" class="bud" transform="translate(38 40) rotate(180) scale(0.8)"/>
    </svg>
    <div class="panel-header">
      <h1 class="paper-title">Community Garden</h1>
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
      <div class="panel-footer">
      <details class="panel-details">
        <summary>How it works</summary>
        <p class="panel-help">A shared garden: anyone can plant an empty plot, and anyone can water any plot. Drag to look around and click a plot to act on it. The ring around a plant shows who watered it last, and it pulses when the plant gets thirsty.</p>
      </details>
      <p class="panel-link"><a href="/readme/">About this app</a></p>
      </div>
    </div>
  </aside>

  <aside id="feed-panel" class="panel paper" aria-label="Recent activity">
    <svg class="sprig" viewBox="0 0 70 46" aria-hidden="true" focusable="false">
      <path class="vine-stem s2" d="M2 6 C 14 4, 24 14, 36 12 C 46 10, 52 18, 60 16"/>
      <path class="vine-stem s3" d="M36 12 C 38 22, 34 30, 38 38"/>
      <path class="vine-tendril" d="M24 11 C 24 20, 32 22, 32 16"/>
      <path class="sprig-leaf l1" d="M14 8 c -2 -8 -11 -9 -13 -3 c 4 6 10 8 13 3 z"/>
      <path class="sprig-leaf l2" d="M26 12 c 3 7 11 8 14 2 c -5 -5 -11 -6 -14 -2 z"/>
      <path class="sprig-leaf l3" d="M48 12 c -1 -8 -9 -10 -13 -5 c 3 6 9 8 13 5 z"/>
      <path class="sprig-leaf l1" d="M38 30 c 6 -3 11 1 10 6 c -5 2 -10 0 -10 -6 z"/>
      <use href="#vine-bud" class="bud" transform="translate(38 40) rotate(180) scale(0.8)"/>
    </svg>
    <div class="panel-header">
      <h2 class="paper-title">Recent</h2>
      <button type="button" id="feed-toggle" class="panel-toggle" aria-expanded="true" aria-controls="feed-body">Hide</button>
    </div>
    <div id="feed-body" class="panel-body">
      <ul id="feed-list" aria-live="polite"></ul>
      <p id="feed-empty" class="feed-empty">Nothing yet. Plant something to start.</p>
    </div>
  </aside>

  <aside id="gardener-panel" class="panel paper journal" aria-label="My journal">
      <svg class="journal-vine" viewBox="0 0 170 96" aria-hidden="true" focusable="false">
        <defs>
          <g id="vine-leaf">
            <path class="leaf-blade" d="M0 0 C 3 -9, 16 -12, 28 -1 C 17 11, 5 9, 0 0 Z"/>
            <path class="leaf-vein" d="M0 0 L 25 -1 M8 -0.5 L 14 -6 M8 -0.5 L 13 5 M16 -0.8 L 21 -5 M16 -0.8 L 20 3"/>
          </g>
          <g id="vine-bud">
            <path class="bud-petal" d="M0 0 C -3 -4, -1 -9, 0 -10 C 1 -9, 3 -4, 0 0 Z"/>
            <path class="bud-petal" d="M0 0 C -6 -2, -9 -6, -8 -8 C -6 -8, -2 -5, 0 0 Z"/>
            <path class="bud-petal" d="M0 0 C 6 -2, 9 -6, 8 -8 C 6 -8, 2 -5, 0 0 Z"/>
            <circle class="bud-heart" cx="0" cy="-1" r="1.4"/>
          </g>
        </defs>
        <!-- the main stem, thinner towards its tip, and two side shoots -->
        <path class="vine-stem s1" d="M168 6 C 150 4, 138 16, 122 14 C 108 12, 100 24, 86 24"/>
        <path class="vine-stem s2" d="M86 24 C 72 24, 66 14, 52 16 C 40 18, 36 30, 24 32"/>
        <path class="vine-stem s3" d="M24 32 C 14 34, 8 42, 10 52"/>
        <path class="vine-stem s2" d="M122 14 C 120 28, 130 38, 124 54 C 121 63, 126 70, 122 78"/>
        <path class="vine-stem s3" d="M86 24 C 84 36, 92 44, 88 56"/>
        <!-- curling tendrils -->
        <path class="vine-tendril" d="M138 15 C 142 26, 154 26, 154 18 C 154 12, 146 12, 147 18"/>
        <path class="vine-tendril" d="M52 16 C 50 6, 40 4, 38 10 C 37 15, 43 16, 44 12"/>
        <path class="vine-tendril" d="M10 52 C 6 60, 12 68, 18 64 C 21 61, 17 57, 14 59"/>
        <path class="vine-tendril" d="M104 22 C 110 32, 120 30, 118 24"/>
        <!-- leaves, each turned and sized a little differently -->
        <use href="#vine-leaf" class="leaf l1" transform="translate(158 8) rotate(-150) scale(0.95)"/>
        <use href="#vine-leaf" class="leaf l2" transform="translate(144 12) rotate(55) scale(1.05)"/>
        <use href="#vine-leaf" class="leaf l3" transform="translate(122 14) rotate(-120) scale(1.1)"/>
        <use href="#vine-leaf" class="leaf l1" transform="translate(106 21) rotate(60) scale(0.9)"/>
        <use href="#vine-leaf" class="leaf l2" transform="translate(86 24) rotate(-100) scale(1.15)"/>
        <use href="#vine-leaf" class="leaf l3" transform="translate(66 16) rotate(40) scale(1)"/>
        <use href="#vine-leaf" class="leaf l1" transform="translate(52 16) rotate(-130) scale(0.9)"/>
        <use href="#vine-leaf" class="leaf l2" transform="translate(38 24) rotate(70) scale(1.05)"/>
        <use href="#vine-leaf" class="leaf l3" transform="translate(24 32) rotate(-140) scale(0.95)"/>
        <use href="#vine-leaf" class="leaf l1" transform="translate(126 44) rotate(25) scale(0.9)"/>
        <use href="#vine-leaf" class="leaf l2" transform="translate(124 62) rotate(150) scale(0.85)"/>
        <use href="#vine-leaf" class="leaf l3" transform="translate(88 44) rotate(160) scale(0.85)"/>
        <use href="#vine-leaf" class="leaf l2" transform="translate(9 50) rotate(110) scale(0.8)"/>
        <!-- small blossoms and a berry or two -->
        <use href="#vine-bud" class="bud" transform="translate(122 80) rotate(180) scale(1)"/>
        <use href="#vine-bud" class="bud" transform="translate(88 58) rotate(180) scale(0.85)"/>
        <use href="#vine-bud" class="bud" transform="translate(94 20) rotate(30) scale(0.8)"/>
        <circle class="vine-berry" cx="136" cy="30" r="2.2"/>
        <circle class="vine-berry" cx="140" cy="34" r="1.9"/>
        <path class="vine-sparkle" d="M60 42 l 1.2 3.6 l 3.6 1.2 l -3.6 1.2 l -1.2 3.6 l -1.2 -3.6 l -3.6 -1.2 l 3.6 -1.2 z"/>
        <path class="vine-sparkle vine-sparkle-late" d="M150 44 l 1 3 l 3 1 l -3 1 l -1 3 l -1 -3 l -3 -1 l 3 -1 z"/>
      </svg>
    <div class="panel-header">
      <h2 class="paper-title"><span id="you-chip" class="you-chip"></span>My journal</h2>
      <button type="button" id="gardener-toggle" class="panel-toggle" aria-expanded="true" aria-controls="gardener-body">Hide</button>
    </div>
    <div id="gardener-body" class="panel-body">
      <p id="you-since" class="you-since">Your record starts with your first action</p>
      <div class="you-actions">
        <button type="button" id="camera-button" class="journal-action" aria-label="Take a photo of the garden"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.6"/></svg><span>Camera</span></button>
        <button type="button" id="wave-button" class="journal-action" aria-label="Wave hello to everyone in the garden"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.6 6.5-6.2 6.5-2.6 0-4.2-1.4-5.4-3.4L3.8 14.3a1.4 1.4 0 0 1 2.3-1.5L8 15"/><path d="M19.5 4.5c.9.7 1.5 1.7 1.6 2.8"/></svg><span>Wave</span></button>
        <button type="button" id="bag-button" class="journal-action" aria-expanded="false" aria-controls="bag" aria-label="Open your bag of seeds"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M6.2 8h11.6l1.4 12H4.8z"/><path d="M9.5 12.5c.6.9 1.4 1.3 2.5 1.3s1.9-.4 2.5-1.3"/></svg><span>Bag</span></button>
      </div>
      <!-- In your own garden only: the seeds you can plant, as "What to plant" is in the shared garden. -->
      <div id="own-seeds" class="own-seeds">
        <h3 class="paper-heading">What to plant</h3>
        <p id="own-seed" class="own-note"></p>
        <div id="own-picker" role="radiogroup" aria-label="Choose a seed to plant" hidden></div>
      </div>
      <!-- In your own garden only: the decorations you have unlocked, to put out or take away. -->
      <div id="own-decor" class="own-seeds" hidden>
        <h3 class="paper-heading">Decorations</h3>
        <p id="decor-locked" class="locked-note" hidden><svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="9" rx="2"/><circle cx="12" cy="15.5" r="1.2"/></svg><span>Locked. Water plants in the shared garden to unlock decorations for your garden.</span></p>
        <div id="decor-picker" role="group" aria-label="Decorations for your garden"></div>
      </div>
      <!-- In your own garden only, once a pet has been unlocked: choose a kind, give it a name, feed it. -->
      <div id="own-pet" class="own-seeds" hidden>
        <h3 class="paper-heading">Your pet</h3>
        <p id="pet-locked" class="locked-note" hidden><svg class="lock-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="9" rx="2"/><circle cx="12" cy="15.5" r="1.2"/></svg><span>Locked. A pet comes after your last decoration.</span></p>
        <form id="pet-form" autocomplete="off" novalidate>
          <div id="pet-kinds" role="radiogroup" aria-label="Kind of pet"></div>
          <label class="pet-name-label" for="pet-name">Name</label>
          <input id="pet-name" type="text" maxlength="12" inputmode="text" autocapitalize="words" spellcheck="false" placeholder="1 to 12 letters or digits" />
          <div class="pet-actions">
            <button type="submit" id="pet-save">Keep</button>
            <button type="button" id="pet-feed" hidden>Feed</button>
          </div>
        </form>
        <p id="pet-note" class="own-note" role="status"></p>
      </div>
      <h3 class="paper-heading">My record</h3>
      <!-- A plain record, private to you: one line, no tiles, totals or goals. -->
      <p id="you-counts" class="you-counts">
        <span>Planted <b id="count-planted">0</b></span><span class="dot" aria-hidden="true"> · </span><span>Watered <b id="count-watered">0</b></span><span class="dot" aria-hidden="true"> · </span><span>Composted <b id="count-composted">0</b></span>
      </p>
      <!-- How many more waterings of the shared garden until the next decoration, and nothing more. -->
      <p id="decor-next" class="decor-next" hidden></p>
      <details id="album" class="journal-album">
        <summary class="album-tab"><svg class="album-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4.5" width="18" height="15" rx="1.5"/><circle cx="8.5" cy="9.5" r="1.7"/><path d="M3.5 17l5-5 3.5 3.5 3-3 5.5 5"/></svg><span>Album</span></summary>
        <p id="album-note" class="panel-help">Photos you take are kept in this browser only. Nobody else sees them.</p>
        <div id="album-grid" role="list"></div>
      </details>
    </div>
  </aside>
  </div>

  <button type="button" id="bed-sign" class="bed-sign" hidden>
    <span class="bed-sign-label"></span>
  </button>

  <!-- The same kind of sign, floating over your own garden: it is the way in. -->
  <button type="button" id="own-sign" class="bed-sign own-sign" aria-label="Visit your own garden, which only you can see" hidden>
    <span class="bed-sign-label">My garden</span>
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

  <!-- On a phone the journal starts closed, so its two actions also float in reach. -->
  <div id="quick-actions">
    <button type="button" id="quick-camera" class="quick-action" aria-label="Take a photo of the garden"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 8h3l1.6-2.2h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.6"/></svg></button>
    <button type="button" id="quick-bag" class="quick-action" aria-expanded="false" aria-controls="bag" aria-label="Open your bag of seeds"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/><path d="M6.2 8h11.6l1.4 12H4.8z"/><path d="M9.5 12.5c.6.9 1.4 1.3 2.5 1.3s1.9-.4 2.5-1.3"/></svg></button>
    <button type="button" id="quick-wave" class="quick-action" aria-label="Wave hello to everyone in the garden"><svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12"/><path d="M11 11V5a1.5 1.5 0 0 1 3 0v6"/><path d="M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.6 6.5-6.2 6.5-2.6 0-4.2-1.4-5.4-3.4L3.8 14.3a1.4 1.4 0 0 1 2.3-1.5L8 15"/><path d="M19.5 4.5c.9.7 1.5 1.7 1.6 2.8"/></svg></button>
  </div>

  <!-- In your own garden: the way back. The seeds to plant are in the journal. -->
  <div id="own-bar" class="paper" role="region" aria-label="Your own garden" hidden>
    <div class="own-bar-head">
      <h2 class="paper-title">My garden</h2>
      <button type="button" id="own-back">Back<span class="own-back-long"> to the shared garden</span></button>
    </div>
    <p class="own-note">Only you can see it. Plant your seeds and look after them.</p>
  </div>

  <!-- Said once, in the middle of the screen, when a pet has been unlocked. Only you see it. -->
  <div id="unlock-toast" class="paper" role="status" aria-live="polite" hidden>
    <h2 id="toast-title" class="paper-title"></h2>
    <p id="toast-body"></p>
    <div class="toast-actions">
      <button type="button" id="toast-go">Visit my garden</button>
      <button type="button" id="toast-close">Got it</button>
    </div>
  </div>

  <!-- Your bag: the seeds you have gathered, as packets. Only you ever see it. -->
  <div id="bag" class="paper" role="dialog" aria-labelledby="bag-title" hidden>
    <div class="bag-head">
      <h2 id="bag-title" class="paper-title">My bag</h2>
      <button type="button" id="bag-close">Close</button>
    </div>
    <div id="bag-list" role="list" aria-label="Seeds in your bag"></div>
    <p id="bag-empty" class="own-note">Your bag is empty. Gather seeds from a fully grown plant in the shared garden.</p>
  </div>

  <!-- A fully grown plant can be watered, or have some of its seeds gathered. -->
  <div id="plot-choice" role="dialog" aria-labelledby="plot-choice-label" hidden>
    <p id="plot-choice-label"></p>
    <div class="plot-choice-buttons">
      <button type="button" id="choice-water">Water</button>
      <button type="button" id="choice-gather">Gather seeds</button>
      <button type="button" id="choice-cancel" class="choice-cancel">Not now</button>
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
