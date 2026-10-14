import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Four beds of 25, each in its own area with its own path, in a square: plots 0 to
// 24 are Bed 1, 25 to 49 Bed 2, 50 to 74 Bed 3 and 75 to 99 Bed 4. Stone walkways
// join each bed to its two neighbours round the square.
const BED_PLOTS = 25;
const BEDS = 4;
const GRID_SIZE = BED_PLOTS * BEDS;
const COLS = 5;
// Where each bed's centre is. Bed 1 stays where the garden always was; Bed 2 is to
// its right, and Beds 3 and 4 behind those two.
const BED_GAP = 12;
const BED_CENTRES = [
  { x: 0, z: 0 },
  { x: BED_GAP, z: 0 },
  { x: 0, z: -BED_GAP },
  { x: BED_GAP, z: -BED_GAP },
];
// The middle of the square of beds: the camera always looks inwards across it.
const GARDEN_CENTRE = { x: BED_GAP / 2, z: -BED_GAP / 2 };
const TILE_SIZE = 0.9;
const TILE_HEIGHT = 0.15;
const SPACING = 1.0;
const WATER_DURATION_MS = 900;
// The last quarter of a plot's wilt window counts as "thirsty".
const THIRSTY_FRACTION = 0.25;

const PLANT_TYPES = ["tree", "flower", "shrub"];

const PLANT_NAME = { tree: "Tree", flower: "Flower", shrub: "Flower shrub" };

// The same four growth stages mean different things for each plant.
const STAGE_LABEL = {
  tree: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "fruiting" },
  flower: { planted: "just planted", sprout: "sprouting", growing: "budding", mature: "in bloom" },
  shrub: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "in flower" },
};

const PALETTE = {
  soilDry: 0xc9a876,
  soilRich: 0x6b4a34,
  soilWilted: 0x9c8769,
  seedTree: 0x3f7d32,
  seedFlower: 0xb5835a,
  seedShrub: 0x5f8f4a,
  stemSprout: 0x6a9b46,
  foliageSprout: 0x8fc45f,
  trunk: 0x6b4423,
  foliageTree: 0x5a9c48,
  fruit: 0xdd6b55,
  flowerStem: 0x5fa04b,
  flowerLeaf: 0x7cc063,
  flowerBud: 0xa8d672,
  petal: 0xf58fb9,
  petalCentre: 0xffd54a,
  shrubLeaf: 0x4f9e5a,
  shrubLeafLight: 0x6bb36e,
  shrubBloomPink: 0xf58fb9,
  shrubBloomWhite: 0xfff3fa,
  wiltedWood: 0x8a6b4f,
  wiltedFoliage: 0xab8f66,
};

// Filled in by the server's `hello` event on connect. `me` is this viewer's
// own public id; thirst is measured on the server's clock, so offset the
// local one by however far apart the two were when hello arrived.
let me = null;
let wiltWindowMs = null;
let clockOffset = 0;

function serverNow() {
  return Date.now() + clockOffset;
}

// A stable colour per person, derived from their public id.
const colourCache = new Map();
function colourFor(publicId) {
  let colour = colourCache.get(publicId);
  if (!colour) {
    const hue = parseInt(publicId.slice(0, 6), 16) % 360;
    colour = new THREE.Color().setHSL(hue / 360, 0.7, 0.55);
    colourCache.set(publicId, colour);
  }
  return colour;
}

// 1 right after watering, falling to 0 as the plant reaches the wilt window.
function freshnessOf(plot) {
  if (wiltWindowMs === null || plot.lastWateredAt === null) return 1;
  const age = serverNow() - plot.lastWateredAt;
  return Math.min(Math.max(1 - age / wiltWindowMs, 0), 1);
}

function isThirsty(plot) {
  return plot.state !== "empty" && plot.state !== "wilted" && freshnessOf(plot) < THIRSTY_FRACTION;
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

function actionFor(state) {
  if (state === "empty") return "plant";
  if (state === "wilted") return "compost";
  return "water";
}

function worldPosition(position) {
  const bed = Math.floor(position / BED_PLOTS);
  const inBed = position % BED_PLOTS;
  const row = Math.floor(inBed / COLS);
  const col = inBed % COLS;
  return { x: BED_CENTRES[bed].x + (col - 2) * SPACING, z: BED_CENTRES[bed].z + (row - 2) * SPACING };
}

function soilColorFor(state) {
  if (state === "empty") return PALETTE.soilDry;
  if (state === "wilted") return PALETTE.soilWilted;
  return PALETTE.soilRich;
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const material of materials) material.dispose();
    }
  });
}

function flatMaterial(color) {
  return new THREE.MeshStandardMaterial({ color, flatShading: true });
}

// All plant shapes are procedural primitives — no model assets. Each
// returns a fresh group local to the plot's soil-top origin (y = 0).
function part(geometry, colour, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, flatMaterial(colour));
  mesh.position.set(x, y, z);
  return mesh;
}

function buildSeeds(type) {
  const group = new THREE.Group();
  const colour = type === "flower" ? PALETTE.seedFlower : type === "shrub" ? PALETTE.seedShrub : PALETTE.seedTree;
  for (let i = 0; i < 3; i++) {
    group.add(part(new THREE.SphereGeometry(0.07, 6, 4), colour, (i - 1) * 0.08, 0.05, (i % 2) * 0.05));
  }
  return group;
}

function buildSprout(type) {
  const group = new THREE.Group();
  if (type === "flower") {
    group.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), PALETTE.flowerStem, 0, 0.11, 0));
    for (const side of [-1, 1]) {
      const leaf = part(new THREE.ConeGeometry(0.05, 0.13, 4), PALETTE.flowerLeaf, side * 0.06, 0.13, 0);
      leaf.rotation.z = -side * 1.1;
      group.add(leaf);
    }
  } else if (type === "shrub") {
    group.add(part(new THREE.SphereGeometry(0.1, 6, 5), PALETTE.shrubLeaf, -0.05, 0.08, 0));
    group.add(part(new THREE.SphereGeometry(0.08, 6, 5), PALETTE.shrubLeafLight, 0.07, 0.07, 0.03));
  } else {
    group.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), PALETTE.stemSprout, 0, 0.12, 0));
    group.add(part(new THREE.ConeGeometry(0.1, 0.2, 6), PALETTE.foliageSprout, 0, 0.3, 0));
  }
  return group;
}

function buildTree(mature) {
  const group = new THREE.Group();
  group.add(part(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 7), PALETTE.trunk, 0, 0.17, 0));
  group.add(part(new THREE.ConeGeometry(0.28, 0.5, 7), PALETTE.foliageTree, 0, 0.55, 0));
  if (mature) {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      group.add(
        part(new THREE.SphereGeometry(0.05, 6, 4), PALETTE.fruit, Math.cos(angle) * 0.2, 0.45, Math.sin(angle) * 0.2),
      );
    }
  }
  return group;
}

function buildFlower(mature) {
  const group = new THREE.Group();
  group.add(part(new THREE.CylinderGeometry(0.025, 0.03, 0.4, 6), PALETTE.flowerStem, 0, 0.2, 0));
  for (const side of [-1, 1]) {
    const leaf = part(new THREE.ConeGeometry(0.06, 0.16, 4), PALETTE.flowerLeaf, side * 0.08, 0.14, 0);
    leaf.rotation.z = -side * 1.1;
    group.add(leaf);
  }
  if (mature) {
    group.add(part(new THREE.SphereGeometry(0.06, 6, 5), PALETTE.petalCentre, 0, 0.45, 0));
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const petal = part(new THREE.SphereGeometry(0.07, 6, 4), PALETTE.petal, Math.cos(angle) * 0.11, 0.44, Math.sin(angle) * 0.11);
      petal.scale.y = 0.45;
      group.add(petal);
    }
  } else {
    group.add(part(new THREE.SphereGeometry(0.06, 6, 5), PALETTE.flowerBud, 0, 0.43, 0));
  }
  return group;
}

function buildShrub(mature) {
  const group = new THREE.Group();
  group.add(part(new THREE.SphereGeometry(0.22, 7, 5), PALETTE.shrubLeaf, 0, 0.2, 0));
  group.add(part(new THREE.SphereGeometry(0.17, 7, 5), PALETTE.shrubLeafLight, 0.15, 0.16, 0.1));
  group.add(part(new THREE.SphereGeometry(0.17, 7, 5), PALETTE.shrubLeafLight, -0.15, 0.16, 0.08));
  group.add(part(new THREE.SphereGeometry(0.16, 7, 5), PALETTE.shrubLeaf, 0, 0.17, -0.15));
  if (mature) {
    // Small blooms scattered over the top of the bush, pink and white.
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4;
      const radius = 0.08 + (i % 3) * 0.07;
      const y = 0.2 + Math.sqrt(Math.max(0.22 * 0.22 - radius * radius, 0)) * 1.02;
      const colour = i % 2 === 0 ? PALETTE.shrubBloomPink : PALETTE.shrubBloomWhite;
      group.add(part(new THREE.SphereGeometry(0.045, 6, 4), colour, Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
  }
  return group;
}

// wilted: a collapsed, drooping, brown version of whichever plant it was.
function buildWilted(type) {
  const group = new THREE.Group();
  if (type === "flower") {
    group.add(part(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 6), PALETTE.wiltedWood, 0, 0.16, 0));
    group.add(part(new THREE.SphereGeometry(0.06, 6, 5), PALETTE.wiltedFoliage, 0, 0.34, 0));
    group.rotation.z = 0.6;
  } else if (type === "shrub") {
    const bush = part(new THREE.SphereGeometry(0.22, 7, 5), PALETTE.wiltedFoliage, 0, 0.12, 0);
    bush.scale.y = 0.5;
    group.add(bush);
    group.scale.setScalar(0.85);
  } else {
    group.add(part(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 7), PALETTE.wiltedWood, 0, 0.17, 0));
    const foliage = part(new THREE.ConeGeometry(0.28, 0.5, 7), PALETTE.wiltedFoliage, 0, 0.45, 0);
    foliage.scale.y = 0.5;
    group.add(foliage);
    group.scale.setScalar(0.7);
    group.rotation.z = 0.4;
  }
  return group;
}

function buildPlant(type, state) {
  if (state === "empty") return new THREE.Group();
  if (state === "wilted") return buildWilted(type);
  if (state === "planted") return buildSeeds(type);
  if (state === "sprout") return buildSprout(type);

  const mature = state === "mature";
  if (type === "flower") return buildFlower(mature);
  if (type === "shrub") return buildShrub(mature);
  return buildTree(mature);
}

const container = document.getElementById("scene-container");
const statusBar = document.getElementById("status-bar");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe3f0);

// Low enough, and aimed a little above the bed, that a strip of sky shows above
// the horizon behind it.
const CAMERA_TARGET = new THREE.Vector3(0, 0.7, 0);
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 120);
// From outside the square, looking across Bed 1 towards the other beds, so they
// show in the distance and can be hovered and clicked to go there.
camera.position.set(-6.5, 4.2, 6.5);
camera.lookAt(CAMERA_TARGET);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(container.clientWidth, container.clientHeight);
container.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);
// The sun by day and the moon by night: one light that follows whichever is up.
const skyLight = new THREE.DirectionalLight(0xfff4e0, 0.8);
skyLight.position.set(5, 10, 7.5);
scene.add(skyLight);

// A shared day: the phase comes from the server's clock (see `hello`), so
// everyone in the garden sees the same sky at the same moment.
let dayLengthMs = 30 * 60_000;

// Phase 0 is midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. Between keys,
// everything is blended.
const SKY_KEYS = [
  { at: 0.0, sky: 0x0b1530, ambient: 0x7d8ad8, ambientI: 0.6, light: 0xa9bcff, lightI: 0.45, stars: 1 },
  { at: 0.19, sky: 0x0b1530, ambient: 0x7d8ad8, ambientI: 0.6, light: 0xa9bcff, lightI: 0.45, stars: 1 },
  { at: 0.26, sky: 0xf2a37c, ambient: 0xffd2b0, ambientI: 0.5, light: 0xffb27a, lightI: 0.6, stars: 0 },
  { at: 0.34, sky: 0xbfe3f0, ambient: 0xffffff, ambientI: 0.7, light: 0xfff4e0, lightI: 0.8, stars: 0 },
  { at: 0.66, sky: 0xbfe3f0, ambient: 0xffffff, ambientI: 0.7, light: 0xfff4e0, lightI: 0.8, stars: 0 },
  { at: 0.74, sky: 0xf08a5d, ambient: 0xffc39a, ambientI: 0.5, light: 0xff9a5a, lightI: 0.6, stars: 0 },
  { at: 0.8, sky: 0x3a2f5c, ambient: 0x8a7bd1, ambientI: 0.42, light: 0xb39cff, lightI: 0.35, stars: 0.5 },
  { at: 0.86, sky: 0x0b1530, ambient: 0x7d8ad8, ambientI: 0.6, light: 0xa9bcff, lightI: 0.45, stars: 1 },
  { at: 1.0, sky: 0x0b1530, ambient: 0x7d8ad8, ambientI: 0.6, light: 0xa9bcff, lightI: 0.45, stars: 1 },
];

const SKY_DISTANCE = 25;

// Grass all round the bed, wide enough to reach the horizon. Fog in the sky's
// colour fades its far edge into the sky, so there's no visible rim.
const GROUND_Y = -0.46;
const ground = new THREE.Mesh(new THREE.CircleGeometry(80, 48), flatMaterial(0x7fae5a));
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
scene.add(ground);
scene.fog = new THREE.Fog(0xbfe3f0, 22, 60);

// The sun and moon rise from the horizon on the left, pass low behind the bed
// where the camera can see them, and set behind the ground on the right.
const ARC_BEHIND = new THREE.Vector3(-1, 0, -1).normalize().multiplyScalar(45);
const ARC_ACROSS = new THREE.Vector3(1, 0, -1).normalize().multiplyScalar(40);
const ARC_HEIGHT = 7.5;

// Flat discs that always face the camera: a sphere this far out at the edge of
// the frame gets stretched into an oval by the perspective, a sprite doesn't.
function discTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}
const DISC_TEXTURE = discTexture();

function skyDisc(size, colour) {
  const disc = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: DISC_TEXTURE, color: colour, transparent: true, fog: false }),
  );
  disc.scale.set(size, size, 1);
  return disc;
}
const sunDisc = skyDisc(4.4, 0xffe08a);
const moonDisc = skyDisc(3.2, 0xe8eeff);
scene.add(sunDisc, moonDisc);

// Stars over the whole sky above the horizon.
const starPositions = [];
for (let i = 0; i < 500; i++) {
  const height = 0.03 + Math.random() * 0.97;
  const angle = Math.random() * Math.PI * 2;
  const across = Math.sqrt(1 - height * height);
  starPositions.push(Math.cos(angle) * across * 40, height * 40, Math.sin(angle) * across * 40);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0, depthWrite: false, fog: false }),
);
scene.add(stars);

// Clouds: soft, thin and wispy, on a wide ring round the garden, drifting
// slowly. Each is a few translucent sprites painted with soft-edged puffs, so
// the edges blur like real cloud instead of showing facets. They are tinted from
// the sky's own colour (white by day, peach at sunset, a dim blue at night) and
// ignore the fog so they stay visible out at the horizon. Positions are a pure
// function of the server's clock, so everyone sees the same clouds in the same
// places. Seen from the default view they drift from left to right.
const CLOUD_COUNT = 16;

// A fixed pseudo-random number in [0, 1) for each n, so the clouds are the same
// shape and place for everyone.
function seeded(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// One cloud texture: a row of overlapping soft puffs, taller in the middle, with
// the bottom faded away so it sits flat like a real cloud base.
function cloudTexture(seed) {
  const width = 256;
  const height = 96;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  const puffs = 9;
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1);
    const bump = Math.sin(t * Math.PI);
    const x = width * (0.12 + 0.76 * t) + (seeded(seed * 17 + i) - 0.5) * 18;
    const radius = 14 + bump * 20 * (0.6 + seeded(seed * 29 + i) * 0.8);
    const y = height * 0.62 - bump * 10 * seeded(seed * 41 + i);
    const puff = ctx.createRadialGradient(x, y, 0, x, y, radius);
    puff.addColorStop(0, "rgba(255,255,255,0.55)");
    puff.addColorStop(0.5, "rgba(255,255,255,0.28)");
    puff.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = puff;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.globalCompositeOperation = "destination-in";
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, "rgba(0,0,0,1)");
  base.addColorStop(0.6, "rgba(0,0,0,1)");
  base.addColorStop(0.88, "rgba(0,0,0,0)");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);
  return new THREE.CanvasTexture(canvas);
}

const cloudMaterials = [0, 1, 2].map(
  (seed) => new THREE.SpriteMaterial({ map: cloudTexture(seed), transparent: true, depthWrite: false, fog: false }),
);

const clouds = [];
for (let i = 0; i < CLOUD_COUNT; i++) {
  const group = new THREE.Group();
  const width = 12 + seeded(i * 19) * 9;

  // The body of the cloud, a smaller one tucked beside it, and a long thin wisp.
  const parts = [
    { material: i % 3, x: 0, y: 0, w: width, h: width * 0.28 },
    { material: (i + 1) % 3, x: (seeded(i * 7) - 0.5) * width * 0.6, y: width * 0.03, w: width * 0.65, h: width * 0.2 },
    { material: (i + 2) % 3, x: (seeded(i * 11) - 0.5) * width * 0.3, y: -width * 0.02, w: width * 1.35, h: width * 0.12 },
  ];
  for (const part of parts) {
    const sprite = new THREE.Sprite(cloudMaterials[part.material]);
    sprite.position.set(part.x, part.y, 0);
    sprite.scale.set(part.w, part.h, 1);
    group.add(sprite);
  }
  scene.add(group);
  clouds.push({
    group,
    theta0: (i / CLOUD_COUNT) * Math.PI * 2 + seeded(i * 29) * 0.4,
    radius: 50 + seeded(i * 31) * 16,
    height: GROUND_Y + 3.8 + seeded(i * 37) * 3.4,
    speed: 0.004 + seeded(i * 41) * 0.004,
  });
}

const CLOUD_WHITE = new THREE.Color(0xffffff);
const cloudColour = new THREE.Color();

function updateClouds(timeSeconds) {
  // The sky's own colour, mixed toward white the brighter the sky is: pure white
  // at noon, a pale peach against a sunset and a dim blue at night.
  const brightness = skyColour.r * 0.2126 + skyColour.g * 0.7152 + skyColour.b * 0.0722;
  cloudColour.copy(skyColour).lerp(CLOUD_WHITE, Math.min(0.2 + 0.85 * brightness, 0.95));
  for (const material of cloudMaterials) material.color.copy(cloudColour);

  for (const cloud of clouds) {
    const theta = cloud.theta0 + cloud.speed * timeSeconds;
    cloud.group.position.set(Math.cos(theta) * cloud.radius, cloud.height, Math.sin(theta) * cloud.radius);
    // The cloud's long axis lies along its path.
    cloud.group.rotation.y = -(theta + Math.PI / 2);
  }
}

let dayness = 1;

const skyColour = new THREE.Color();
const ambientColour = new THREE.Color();
const lightColour = new THREE.Color();
const keyColourA = new THREE.Color();
const keyColourB = new THREE.Color();

function blendColour(target, from, to, t) {
  keyColourA.setHex(from);
  keyColourB.setHex(to);
  return target.lerpColors(keyColourA, keyColourB, t);
}

// Where the sun or moon sits on its arc: angle 0 as it rises on the left, PI as
// it sets on the right. Below the horizon the ground hides it, and it fades at
// the horizon rather than popping.
function placeOnArc(mesh, angle) {
  mesh.position
    .copy(ARC_BEHIND)
    .addScaledVector(ARC_ACROSS, -Math.cos(angle))
    .setY(GROUND_Y + Math.sin(angle) * ARC_HEIGHT);
  const opacity = Math.min(Math.max(Math.sin(angle) * 5, 0), 1);
  mesh.material.opacity = opacity;
  mesh.visible = opacity > 0.01;
}

function updateSky() {
  const phase = (((serverNow() % dayLengthMs) + dayLengthMs) % dayLengthMs) / dayLengthMs;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].at <= phase) i++;
  const from = SKY_KEYS[i];
  const to = SKY_KEYS[i + 1];
  const t = (phase - from.at) / (to.at - from.at);

  scene.background = blendColour(skyColour, from.sky, to.sky, t);
  scene.fog.color.copy(skyColour);
  ambient.color.copy(blendColour(ambientColour, from.ambient, to.ambient, t));
  ambient.intensity = from.ambientI + (to.ambientI - from.ambientI) * t;
  stars.material.opacity = from.stars + (to.stars - from.stars) * t;
  stars.visible = stars.material.opacity > 0.01;

  // The sun is up from 0.25 to 0.75 and the moon the rest of the time.
  const sunAngle = ((phase - 0.25) / 0.5) * Math.PI;
  const moonAngle = ((((phase - 0.75) % 1) + 1) % 1 / 0.5) * Math.PI;
  // 0 at night, easing up to 1 once the sun is well above the horizon: the
  // insects come out with it and leave as it sets.
  dayness = phase >= 0.25 && phase < 0.75 ? Math.min(Math.max(Math.sin(sunAngle) / 0.35, 0), 1) : 0;
  placeOnArc(sunDisc, sunAngle);
  placeOnArc(moonDisc, moonAngle);

  // The light follows whichever body is up, and fades to nothing at the
  // horizon so the swap between sun and moon doesn't make the shadows jump.
  const lightAngle = phase >= 0.25 && phase < 0.75 ? sunAngle : moonAngle;
  const height = Math.sin(lightAngle);
  skyLight.position.set(Math.cos(lightAngle) * SKY_DISTANCE, Math.max(height, 0.05) * SKY_DISTANCE, SKY_DISTANCE * 0.35);
  skyLight.color.copy(blendColour(lightColour, from.light, to.light, t));
  skyLight.intensity = (from.lightI + (to.lightI - from.lightI) * t) * Math.min(Math.max(height / 0.3, 0), 1);
}

const bedBaseGeometry = new THREE.BoxGeometry(COLS * SPACING + 0.6, 0.3, COLS * SPACING + 0.6);
// Each bed has its own base material, so the one you are pointing at can glow a
// little without the other changing.
const bedBaseColour = new THREE.Color(0x7a5a3a);
const bedBases = BED_CENTRES.map((centre) => {
  const bedBase = new THREE.Mesh(bedBaseGeometry, flatMaterial(bedBaseColour));
  bedBase.position.set(centre.x, -0.3, centre.z);
  scene.add(bedBase);
  return bedBase;
});

// The paths: each bed has its own ring of large flagstones set in earth, where the
// gardeners walk, and short stone walkways join neighbouring rings. The loop is
// the square line down the middle of a ring. A figure's position is one fraction
// u from 0 up to but not including 1, so the server never needs to know the shape:
// each quarter of u is round one bed.
const PATH_INNER = 2.8;
const PATH_OUTER = 4.5;
const PATH_TOP = GROUND_Y + 0.07;
const LOOP_HALF = 3.35;
const LOOP_LENGTH = 8 * LOOP_HALF;
const WALKWAY_HALF_WIDTH = 0.85;
// Where on a bed's loop the middle of each side is, as a fraction of the loop
// (see loopPoint): back, right, front, left.
const SIDE_MIDDLE = { back: 0.125, right: 0.375, front: 0.625, left: 0.875 };
// The walkways round the square, each joining the facing sides of two beds.
const WALKWAYS = [
  [0, "right", 1, "left"],
  [1, "back", 3, "front"],
  [3, "left", 2, "right"],
  [2, "front", 0, "back"],
].map(([a, aSide, b, bSide]) => ({ a, aAlong: SIDE_MIDDLE[aSide], b, bAlong: SIDE_MIDDLE[bSide] }));

// Which bed's loop a value of u is on: each quarter of u is one bed.
function bedOf(u) {
  return Math.min(Math.floor((((u % 1) + 1) % 1) * BEDS), BEDS - 1);
}

// Where on its own bed's loop u is, from 0 up to but not including 1.
function alongLoop(u) {
  return ((((u % 1) + 1) % 1) * BEDS) % 1;
}

function toU(bed, along) {
  return (bed + (((along % 1) + 1) % 1)) / BEDS;
}

// Where a point round a bed's loop is, from 0 up to but not including 1: the back
// side first, then the right, the front and the left.
function bedLoopPoint(bed, alongValue) {
  const centre = BED_CENTRES[bed];
  const along = ((((alongValue % 1) + 1) % 1) * 4);
  const side = Math.floor(along);
  const t = (along - side) * 2 - 1;
  if (side === 0) return { x: centre.x + t * LOOP_HALF, z: centre.z - LOOP_HALF };
  if (side === 1) return { x: centre.x + LOOP_HALF, z: centre.z + t * LOOP_HALF };
  if (side === 2) return { x: centre.x - t * LOOP_HALF, z: centre.z + LOOP_HALF };
  return { x: centre.x - LOOP_HALF, z: centre.z - t * LOOP_HALF };
}

function loopPoint(u) {
  return bedLoopPoint(bedOf(u), alongLoop(u));
}

// Each walkway's two ends, on the ground and as u.
for (const walkway of WALKWAYS) {
  walkway.from = bedLoopPoint(walkway.a, walkway.aAlong);
  walkway.to = bedLoopPoint(walkway.b, walkway.bAlong);
  walkway.aU = toU(walkway.a, walkway.aAlong);
  walkway.bU = toU(walkway.b, walkway.bAlong);
  walkway.length = Math.hypot(walkway.to.x - walkway.from.x, walkway.to.z - walkway.from.z);
}


// Earth showing in the gaps between the stones, so they read as set in the ground
// rather than laid on the grass.
const earthMaterial = flatMaterial(0x8a7556);
function earthSlab(x, z, width, depth) {
  const slab = new THREE.Mesh(new THREE.BoxGeometry(width, 0.03, depth), earthMaterial);
  slab.position.set(x, GROUND_Y + 0.015, z);
  scene.add(slab);
}
for (const centre of BED_CENTRES) {
  for (const [x, z, width, depth] of [
    [0, -3.7, 9.4, 2.0],
    [0, 3.7, 9.4, 2.0],
    [-3.7, 0, 2.0, 5.4],
    [3.7, 0, 2.0, 5.4],
  ]) {
    earthSlab(centre.x + x, centre.z + z, width, depth);
  }
}

// One flagstone: an irregular seven-sided slab with softened edges, never the
// same shape twice.
function flagstoneGeometry(seed) {
  const sides = 7;
  const outline = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + (seeded(seed * 7 + i) - 0.5) * 0.4;
    const radius = 0.5 * (0.82 + seeded(seed * 13 + i) * 0.3);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) outline.moveTo(x, y);
    else outline.lineTo(x, y);
  }
  outline.closePath();
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: 0.05,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.03,
    bevelSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

const flagstoneGeometries = [0, 1, 2, 3, 4, 5, 6, 7].map(flagstoneGeometry);
const stoneMaterials = [0x9b968d, 0x8c8880, 0xa8a398, 0x7d7a73, 0xb0aa9d].map((colour) => flatMaterial(colour));

// Is a spot on a path: on one of the rings, or on a walkway between two?
function onPath(x, z) {
  for (const centre of BED_CENTRES) {
    const edge = Math.max(Math.abs(x - centre.x), Math.abs(z - centre.z));
    if (edge >= PATH_INNER && edge <= PATH_OUTER) return true;
  }
  return WALKWAYS.some((walkway) => {
    const { from, to } = walkway;
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dz);
    const t = ((x - from.x) * dx + (z - from.z) * dz) / (length * length);
    if (t <= 0 || t >= 1) return false;
    return Math.abs((x - from.x) * dz - (z - from.z) * dx) / length <= WALKWAY_HALF_WIDTH;
  });
}

// Stones on a loose, jittered grid across the paths: two across, each turned and
// sized a little differently, with small gaps between.
const STONE_SPACING = 0.95;
const stoneRange = (axis) => {
  const values = BED_CENTRES.map((centre) => centre[axis]);
  return [
    Math.floor((Math.min(...values) - PATH_OUTER) / STONE_SPACING),
    Math.ceil((Math.max(...values) + PATH_OUTER) / STONE_SPACING),
  ];
};
const [STONES_X_FROM, STONES_X_TO] = stoneRange("x");
const [STONES_Z_FROM, STONES_Z_TO] = stoneRange("z");
for (let ix = STONES_X_FROM; ix <= STONES_X_TO; ix++) {
  for (let iz = STONES_Z_FROM; iz <= STONES_Z_TO; iz++) {
    const n = ix * 53 + iz * 29;
    const x = ix * STONE_SPACING + (seeded(n + 1) - 0.5) * 0.16;
    const z = iz * STONE_SPACING + (seeded(n + 2) - 0.5) * 0.16;
    if (!onPath(x, z)) continue;

    const stone = new THREE.Mesh(
      flagstoneGeometries[Math.floor(seeded(n + 3) * flagstoneGeometries.length)],
      stoneMaterials[Math.floor(seeded(n + 4) * stoneMaterials.length)],
    );
    const size = 0.72 + seeded(n + 5) * 0.12;
    stone.scale.set(size * (0.92 + seeded(n + 6) * 0.2), 1, size * (0.92 + seeded(n + 7) * 0.2));
    stone.rotation.y = seeded(n + 8) * Math.PI * 2;
    // A hair of difference in height so touching stones never flicker.
    stone.position.set(x, GROUND_Y + seeded(n + 9) * 0.006, z);
    scene.add(stone);
  }
}

// The walkway between two neighbouring beds, and which end is which for a figure
// going from one to the other.
function walkwayBetween(fromBed, toBed) {
  for (const walkway of WALKWAYS) {
    if (walkway.a === fromBed && walkway.b === toBed) {
      return { walkway, startU: walkway.aU, endU: walkway.bU, start: walkway.from, end: walkway.to };
    }
    if (walkway.b === fromBed && walkway.a === toBed) {
      return { walkway, startU: walkway.bU, endU: walkway.aU, start: walkway.to, end: walkway.from };
    }
  }
  return null;
}

// Beds in order round the square, so a figure can find the shorter way round.
const BED_RING = [0, 1, 3, 2];

// The next bed on the shorter way round the square from one bed to another.
function nextBedTowards(fromBed, toBed) {
  const from = BED_RING.indexOf(fromBed);
  const steps = (BED_RING.indexOf(toBed) - from + BED_RING.length) % BED_RING.length;
  // Straight across the square is as far either way: always go clockwise then.
  const direction = steps <= BED_RING.length / 2 ? 1 : -1;
  return BED_RING[(from + direction + BED_RING.length) % BED_RING.length];
}

// The point on a bed's loop nearest to somewhere on the ground.
function nearestLoopU(x, z, bed) {
  const lx = x - BED_CENTRES[bed].x;
  z -= BED_CENTRES[bed].z;
  const clamp = (v) => Math.min(Math.max(v / LOOP_HALF, -1), 1);
  const candidates = [
    { t: clamp(lx), side: 0, px: clamp(lx) * LOOP_HALF, pz: -LOOP_HALF },
    { t: clamp(z), side: 1, px: LOOP_HALF, pz: clamp(z) * LOOP_HALF },
    { t: clamp(-lx), side: 2, px: -clamp(-lx) * LOOP_HALF, pz: LOOP_HALF },
    { t: clamp(-z), side: 3, px: -LOOP_HALF, pz: -clamp(-z) * LOOP_HALF },
  ];
  let best = candidates[0];
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = (candidate.px - lx) ** 2 + (candidate.pz - z) ** 2;
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return toU(bed, (best.side + (best.t + 1) / 2) / 4);
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(CAMERA_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI / 2 - 0.05;

const panels = document.getElementById("panels");
const panelToggle = document.getElementById("panel-toggle");
const panelBody = document.getElementById("panel-body");
const gardenerToggle = document.getElementById("gardener-toggle");
const gardenerBody = document.getElementById("gardener-body");
const feedToggle = document.getElementById("feed-toggle");
const feedBody = document.getElementById("feed-body");

// The panel covers part of the garden, so slide the view over until the bed
// sits in the middle of the part you can still see. On a wide window the panel
// is on the left; on a narrow one it is a sheet along the bottom.
// One bed and the path round it, which is all the camera frames at a time.
const GARDEN_WIDTH = 1.2;

function updateViewOffset() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  const rect = panels.getBoundingClientRect();
  const narrow = window.matchMedia("(max-width: 700px)").matches;
  // With both panels collapsed they are only small pills in the corner: nothing
  // to avoid.
  const open = !panelBody.hidden || !feedBody.hidden || !gardenerBody.hidden;
  const shiftX = narrow || !open ? 0 : rect.right / 2;
  const shiftY = narrow ? rect.height / 2 : 0;

  // A bed and the path round it are about GARDEN_WIDTH of the window's height
  // wide at full zoom, so if the part of the window the panel leaves free is
  // narrower than that (a phone held upright, or a tablet with the panel open),
  // pull the view back to fit.
  const freeWidth = width - shiftX * 2;
  camera.zoom = Math.min(1, freeWidth / (GARDEN_WIDTH * height));
  camera.setViewOffset(width, height, -shiftX, shiftY, width, height);
}

function onResize() {
  const width = container.clientWidth;
  const height = container.clientHeight;
  camera.aspect = width / height;
  renderer.setSize(width, height);
  updateViewOffset();
}
window.addEventListener("resize", onResize);
onResize();

function setPanelOpen(button, body, open) {
  body.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  button.textContent = open ? "Hide" : "Show";
}

panelToggle.addEventListener("click", () => {
  setPanelOpen(panelToggle, panelBody, panelBody.hidden);
  updateViewOffset();
});

feedToggle.addEventListener("click", () => {
  setPanelOpen(feedToggle, feedBody, feedBody.hidden);
  updateViewOffset();
});

gardenerToggle.addEventListener("click", () => {
  setPanelOpen(gardenerToggle, gardenerBody, gardenerBody.hidden);
  updateViewOffset();
});

// Room is tight on a phone, so the recent list and your own panel start closed there.
if (window.matchMedia("(max-width: 700px)").matches) {
  setPanelOpen(feedToggle, feedBody, false);
  setPanelOpen(gardenerToggle, gardenerBody, false);
  updateViewOffset();
}

// position -> { group, soilMesh, plantGroup, baseSoilColor }
const sceneObjects = new Map();
// position -> latest Plot from the server (SSE only)
const plots = new Map();

for (let position = 0; position < GRID_SIZE; position++) {
  const { x, z } = worldPosition(position);
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const soilMesh = new THREE.Mesh(
    new THREE.BoxGeometry(TILE_SIZE, TILE_HEIGHT, TILE_SIZE),
    flatMaterial(soilColorFor("empty")),
  );
  soilMesh.position.y = -TILE_HEIGHT / 2;
  soilMesh.userData.position = position;
  group.add(soilMesh);

  const plantGroup = buildPlant("tree", "empty");
  group.add(plantGroup);

  // Care ring: a flat square frame just inside the tile edge (a 4-sided
  // ring turned 45 degrees so its edges line up with the tile). Unlit, so
  // its colour reads the same whatever the lighting. Raised a little so it
  // stays visible when hovering lifts the tile.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.48, 0.57, 4, 1, Math.PI / 4),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  ring.visible = false;
  group.add(ring);

  scene.add(group);
  sceneObjects.set(position, {
    group,
    soilMesh,
    plantGroup,
    ring,
    baseSoilColor: new THREE.Color(soilColorFor("empty")),
  });
}

const soilMeshes = [...sceneObjects.values()].map((obj) => obj.soilMesh);

function rebuildPlant(position, type, state) {
  const obj = sceneObjects.get(position);
  disposeGroup(obj.plantGroup);
  obj.group.remove(obj.plantGroup);
  obj.plantGroup = buildPlant(type, state);
  obj.group.add(obj.plantGroup);
  obj.baseSoilColor = new THREE.Color(soilColorFor(state));
  obj.soilMesh.material.color.copy(obj.baseSoilColor);
}

const waterAnimations = new Map();

// Water drops: a burst of small drops falls onto a plot when anyone waters it,
// tinted with the colour of whoever did. They share one geometry and one
// material per colour, and remove themselves as they land.
const DROP_COUNT = 12;
const DROP_GRAVITY = 8;
const DROP_GEOMETRY = new THREE.SphereGeometry(0.034, 6, 4);
const dropMaterials = new Map();
const drops = [];

function dropMaterialFor(colour) {
  const key = colour.getHex();
  let material = dropMaterials.get(key);
  if (!material) {
    material = new THREE.MeshBasicMaterial({ color: colour });
    dropMaterials.set(key, material);
  }
  return material;
}

function spawnDrops(position, wateredBy) {
  const obj = sceneObjects.get(position);
  // Lightened a little so the drops show up against the soil and the grass.
  const colour = (wateredBy ? colourFor(wateredBy) : new THREE.Color(0x6fb7ff)).clone().lerp(new THREE.Color(0xffffff), 0.3);
  const material = dropMaterialFor(colour);
  const start = performance.now();
  for (let i = 0; i < DROP_COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 0.32;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y0 = 0.95 + Math.random() * 0.25;
    const mesh = new THREE.Mesh(DROP_GEOMETRY, material);
    mesh.scale.set(1, 1.5, 1);
    mesh.position.set(x, y0, z);
    mesh.visible = false;
    obj.group.add(mesh);
    drops.push({ mesh, parent: obj.group, y0, start, delay: Math.random() * 280 });
  }
}

function updateDrops(now) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const drop = drops[i];
    const t = (now - drop.start - drop.delay) / 1000;
    if (t < 0) continue;
    const y = drop.y0 - 0.5 * DROP_GRAVITY * t * t;
    if (y <= 0.03) {
      drop.parent.remove(drop.mesh);
      drops.splice(i, 1);
      continue;
    }
    drop.mesh.visible = true;
    drop.mesh.position.y = y;
  }
}

// Action badges: when anyone plants, waters or composts a plot, a small round icon
// floats up above that plot and fades, in the colour of whoever did it, so you can
// see what people are doing without watching their figures. Like the drops, it
// plays from the plot's own update, so it shows in every open tab, including for
// people who didn't click. Composting clears who tended the plot, so it has no
// gardener's colour to use and is drawn in earth brown.
const BADGE_MS = 2200;
const BADGE_HEIGHT = 1.2;
const BADGE_RISE = 0.4;
const badgeTextures = new Map();
const badges = [];

// An icon for each action, drawn on a canvas: a round white badge with a ring in
// the gardener's colour and the picture inside.
function badgeTexture(action, colour) {
  const key = `${action}-${colour.getHexString()}`;
  let texture = badgeTextures.get(key);
  if (texture) return texture;

  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  // The ring is always the gardener's colour, so you can see who did it. The
  // picture inside is too, except a seedling, which is green.
  const ring = `#${colour.getHexString()}`;
  const ink = action === "plant" ? "#3f9a3a" : ring;

  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(64, 64, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = ring;
  ctx.stroke();

  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.lineCap = "round";
  if (action === "water") {
    // a drop: a round bottom with a point on top
    ctx.beginPath();
    ctx.arc(64, 74, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(64, 24);
    ctx.lineTo(43, 66);
    ctx.lineTo(85, 66);
    ctx.closePath();
    ctx.fill();
  } else if (action === "plant") {
    // a seedling: a stem with a leaf each side
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(64, 98);
    ctx.lineTo(64, 56);
    ctx.stroke();
    for (const [x, y, angle] of [
      [49, 56, -0.6],
      [79, 46, 0.6],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 17, 8, angle, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // a spade: a handle with a grip, and a blade
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(64, 26);
    ctx.lineTo(64, 66);
    ctx.moveTo(52, 26);
    ctx.lineTo(76, 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(46, 66);
    ctx.lineTo(82, 66);
    ctx.lineTo(74, 94);
    ctx.quadraticCurveTo(64, 104, 54, 94);
    ctx.closePath();
    ctx.fill();
  }

  texture = new THREE.CanvasTexture(canvas);
  // The canvas holds ordinary sRGB colours; say so, or they come out washed out.
  texture.colorSpace = THREE.SRGBColorSpace;
  badgeTextures.set(key, texture);
  return texture;
}

function showActionBadge(position, action, doneBy) {
  const obj = sceneObjects.get(position);
  // A newer action on the same plot replaces the one still floating there.
  for (let i = badges.length - 1; i >= 0; i--) {
    if (badges[i].position === position) removeBadge(i);
  }

  const colour = doneBy ? colourFor(doneBy) : new THREE.Color(0x7a5a3a);
  const material = new THREE.SpriteMaterial({ map: badgeTexture(action, colour), transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(0, BADGE_HEIGHT, 0);
  sprite.scale.setScalar(0.01);
  obj.group.add(sprite);
  badges.push({ position, sprite, material, parent: obj.group, start: performance.now() });
}

function removeBadge(index) {
  const badge = badges[index];
  badge.parent.remove(badge.sprite);
  badge.material.dispose();
  badges.splice(index, 1);
}

function updateBadges(now) {
  for (let i = badges.length - 1; i >= 0; i--) {
    const badge = badges[i];
    const t = (now - badge.start) / BADGE_MS;
    if (t >= 1) {
      removeBadge(i);
      continue;
    }
    // Pops in with a little overshoot, drifts up, and fades over the last stretch.
    const pop = Math.min(t / 0.1, 1);
    const overshoot = 1 + 0.3 * Math.sin(pop * Math.PI);
    badge.sprite.scale.setScalar(0.55 * pop * overshoot);
    badge.sprite.position.y = BADGE_HEIGHT + BADGE_RISE * t;
    badge.material.opacity = t < 0.65 ? 1 : 1 - (t - 0.65) / 0.35;
  }
}

function triggerWaterEffect(position, wateredBy) {
  waterAnimations.set(position, { start: performance.now() });
  spawnDrops(position, wateredBy);
}

function tickAnimations(now) {
  for (const [position, anim] of waterAnimations) {
    const t = Math.min((now - anim.start) / WATER_DURATION_MS, 1);
    const obj = sceneObjects.get(position);
    const wet = obj.baseSoilColor.clone().multiplyScalar(0.55);
    obj.soilMesh.material.color.copy(wet).lerp(obj.baseSoilColor, t);
    const bump = 1 + 0.12 * Math.sin(t * Math.PI);
    obj.plantGroup.scale.setScalar(bump);
    if (t >= 1) {
      obj.soilMesh.material.color.copy(obj.baseSoilColor);
      obj.plantGroup.scale.setScalar(1);
      waterAnimations.delete(position);
    }
  }
}

const RING_GREY = new THREE.Color(0x9a9a9a);
const RING_AMBER = new THREE.Color(0xffb020);
const ringColour = new THREE.Color();

// Colour is who watered it last; brightness is how recently; once it's in the
// last stretch before wilting the ring pulses amber and the plant droops. The
// droop and pulse are motion, so the warning doesn't rely on telling hues apart.
function updateRings(now) {
  for (const [position, obj] of sceneObjects) {
    const plot = plots.get(position);
    if (!plot || plot.state === "empty" || plot.state === "wilted") {
      obj.ring.visible = false;
      continue;
    }

    const freshness = freshnessOf(plot);
    const tender = plot.lastWateredBy === null ? RING_GREY : colourFor(plot.lastWateredBy);
    ringColour.copy(RING_GREY).lerp(tender, freshness);
    let opacity = 0.35 + 0.65 * freshness;
    let scale = 1;
    let droop = 0;

    if (freshness < THIRSTY_FRACTION) {
      const thirst = 1 - freshness / THIRSTY_FRACTION;
      const pulse = 0.5 + 0.5 * Math.sin(now / 250);
      ringColour.lerp(RING_AMBER, 0.5 + 0.5 * thirst);
      opacity = 0.45 + 0.55 * pulse;
      scale = 1 + 0.06 * pulse;
      droop = 0.12 * thirst;
    }

    obj.ring.visible = true;
    obj.ring.material.color.copy(ringColour);
    obj.ring.material.opacity = opacity;
    obj.ring.scale.setScalar(scale);
    obj.plantGroup.rotation.z = droop;
  }
}

// Insects: butterflies visit a flower in bloom and bees a shrub in flower, by
// day. They are drawn from primitives like the plants, and their paths are a
// pure function of the server's clock and the plot, so every visitor sees them
// in the same places with nothing sent over the wire. They keep away from
// thirsty plants, so they only turn up where someone has been looking after
// things.
const BUTTERFLY_COLOURS = [0xff9a3c, 0xfff3fa, 0x6fb7ff, 0xd18bff];
const butterflyWingMaterials = BUTTERFLY_COLOURS.map(
  (colour) => new THREE.MeshBasicMaterial({ color: colour, side: THREE.DoubleSide }),
);
const butterflyBodyMaterial = new THREE.MeshBasicMaterial({ color: 0x3a2a20 });
const beeYellowMaterial = new THREE.MeshBasicMaterial({ color: 0xffd23f });
const beeDarkMaterial = new THREE.MeshBasicMaterial({ color: 0x2b2118 });
const beeWingMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.6,
});

// Wings pivot at the body: shift each geometry so its inner edge sits on the origin.
const butterflyWingGeometry = new THREE.PlaneGeometry(0.11, 0.08).translate(0.055, 0, 0);
const butterflyBodyGeometry = new THREE.CylinderGeometry(0.012, 0.012, 0.09, 5).rotateX(Math.PI / 2);
const beeWingGeometry = new THREE.PlaneGeometry(0.06, 0.035).translate(0.03, 0, 0);
const beeBodyGeometry = new THREE.SphereGeometry(0.035, 7, 5);

// A pair of wings hinged at the body, one each side, lying flat until they flap.
function addWings(group, geometry, material, height) {
  const hinges = [];
  for (const side of [1, -1]) {
    const hinge = new THREE.Group();
    hinge.position.y = height;
    const wing = new THREE.Mesh(geometry, material);
    wing.rotation.x = -Math.PI / 2;
    wing.scale.x = side;
    hinge.add(wing);
    group.add(hinge);
    hinges.push({ hinge, side });
  }
  return hinges;
}

function buildInsect(kind, index, position) {
  const group = new THREE.Group();
  if (kind === "butterfly") {
    group.add(new THREE.Mesh(butterflyBodyGeometry, butterflyBodyMaterial));
    const material = butterflyWingMaterials[(position + index) % butterflyWingMaterials.length];
    return { group, hinges: addWings(group, butterflyWingGeometry, material, 0.005) };
  }

  const abdomen = new THREE.Mesh(beeBodyGeometry, beeYellowMaterial);
  abdomen.scale.set(1, 0.9, 1.5);
  const stripe = new THREE.Mesh(beeBodyGeometry, beeDarkMaterial);
  stripe.scale.set(1.04, 0.94, 0.4);
  stripe.position.z = -0.012;
  const head = new THREE.Mesh(beeBodyGeometry, beeDarkMaterial);
  head.scale.setScalar(0.65);
  head.position.z = 0.06;
  group.add(abdomen, stripe, head);
  return { group, hinges: addWings(group, beeWingGeometry, beeWingMaterial, 0.03) };
}

// Where an insect is around its plant at time t (seconds), and the same a
// moment later so it can face the way it's flying.
function insectPath(kind, t, seed) {
  if (kind === "butterfly") {
    return {
      x: 0.32 * Math.sin(0.5 * t + seed) + 0.12 * Math.sin(1.3 * t + 2 * seed),
      y: 0.58 + 0.12 * Math.sin(1.0 * t + seed),
      z: 0.32 * Math.cos(0.4 * t + 1.7 * seed),
    };
  }
  return {
    x: 0.2 * Math.sin(1.2 * t + seed) + 0.06 * Math.sin(4.0 * t),
    y: 0.46 + 0.06 * Math.sin(1.9 * t + seed),
    z: 0.2 * Math.cos(1.0 * t + seed) + 0.05 * Math.cos(3.4 * t),
  };
}

function updateInsects(timeSeconds) {
  const size = dayness * dayness * (3 - 2 * dayness);

  for (const [position, obj] of sceneObjects) {
    const plot = plots.get(position);
    let kind = null;
    if (plot && plot.state === "mature" && !isThirsty(plot)) {
      kind = plot.plantType === "flower" ? "butterfly" : plot.plantType === "shrub" ? "bee" : null;
    }

    if (obj.insectKind !== kind) {
      for (const insect of obj.insects ?? []) obj.group.remove(insect.group);
      obj.insects = kind ? [buildInsect(kind, 0, position)] : [];
      for (const insect of obj.insects) obj.group.add(insect.group);
      obj.insectKind = kind;
    }
    if (!kind) continue;

    obj.insects.forEach((insect, i) => {
      insect.group.visible = size > 0.01;
      if (size <= 0.01) return;

      const seed = position * 1.7 + i * 3.1;
      const now = insectPath(kind, timeSeconds, seed);
      const soon = insectPath(kind, timeSeconds + 0.05, seed);
      insect.group.position.set(now.x, now.y, now.z);
      insect.group.rotation.y = Math.atan2(soon.x - now.x, soon.z - now.z);
      insect.group.scale.setScalar(size * (kind === "butterfly" ? 1.4 : 1.3));

      // Butterflies beat slowly and wide; a bee's wings are a blur.
      const angle =
        kind === "butterfly"
          ? 0.5 + 0.7 * Math.sin(timeSeconds * 10 + seed)
          : 0.3 + 0.35 * Math.sin(timeSeconds * 45 + seed);
      for (const { hinge, side } of insect.hinges) hinge.rotation.z = side * angle;
    });
  }
}

let hoveredPosition = null;
let messageTimer = null;

// What a click on an empty plot plants. Remembered in the browser; if storage
// is blocked it just starts as a tree each visit.
function readStoredType() {
  try {
    const stored = localStorage.getItem("plantType");
    return PLANT_TYPES.includes(stored) ? stored : "tree";
  } catch {
    return "tree";
  }
}
let selectedType = readStoredType();

function describePlot(plot) {
  if (plot.state === "empty") {
    return `Empty plot — click to plant a ${PLANT_NAME[selectedType].toLowerCase()}`;
  }
  const type = plot.plantType ?? "tree";
  if (plot.state === "wilted") return `${PLANT_NAME[type]}, wilted — needs composting`;
  return `${PLANT_NAME[type]}, ${STAGE_LABEL[type][plot.state]}`;
}

function refreshStatusBarForHover(plot) {
  if (!plot) return;
  statusBar.textContent = describePlot(plot);

  if (plot.lastWateredAt !== null) {
    statusBar.append(` — watered ${formatAgo(plot.lastWateredAt, serverNow())} by `);
    if (plot.lastWateredBy !== null) {
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = `#${colourFor(plot.lastWateredBy).getHexString()}`;
      statusBar.append(swatch, plot.lastWateredBy === me ? "you" : "another gardener");
    } else {
      statusBar.append("someone");
    }
  }

  if (isThirsty(plot)) statusBar.append(" (thirsty)");
}

function clearStatusBarHover() {
  statusBar.textContent = "Hover a plot to see its status. Click to act.";
}

function showStatusMessage(text) {
  clearTimeout(messageTimer);
  statusBar.textContent = text;
  messageTimer = setTimeout(() => {
    if (hoveredPosition !== null) refreshStatusBarForHover(plots.get(hoveredPosition));
    else clearStatusBarHover();
  }, 4000);
}

// Going to a bed. You look at one bed at a time; the other shows in the distance,
// and hovering it offers to take you there. Clicking glides the camera over, and
// your figure walks there, round the path and across the walkway. Which bed you
// are at limits nothing: anyone can still act on any plot.
const BED_GLIDE_MS = 800;
const BED_NAMES = ["the first bed", "the second bed", "the third bed", "the fourth bed"];
// A little above the far bed's middle, where its sign floats.
const BED_SIGN_HEIGHT = 1.6;
let currentBed = 0;
let glide = null; // { start, fromTarget, toTarget, fromCamera, toCamera }

function bedOfPosition(position) {
  return Math.floor(position / BED_PLOTS);
}

// Which bed's area a spot on the ground is in: the bed and the path round it.
// null for open grass and the walkway between them.
function bedAreaAt(x, z) {
  for (let bed = 0; bed < BEDS; bed++) {
    const centre = BED_CENTRES[bed];
    if (Math.max(Math.abs(x - centre.x), Math.abs(z - centre.z)) <= PATH_OUTER) return bed;
  }
  return null;
}

function goToBed(bed) {
  if (bed === currentBed) return;
  currentBed = bed;
  setHoveredBed(null);

  // Look at the new bed from outside the square, across it towards the others, so
  // they show in the distance. Height and zoom stay as you had them.
  const offset = camera.position.clone().sub(controls.target);
  const flat = Math.hypot(offset.x, offset.z);
  const centre = BED_CENTRES[bed];
  const outX = centre.x - GARDEN_CENTRE.x;
  const outZ = centre.z - GARDEN_CENTRE.z;
  const outLength = Math.hypot(outX, outZ);
  offset.x = (outX / outLength) * flat;
  offset.z = (outZ / outLength) * flat;
  const toTarget = controls.target.clone().setX(centre.x).setZ(centre.z);
  glide = {
    start: performance.now(),
    fromTarget: controls.target.clone(),
    toTarget,
    fromCamera: camera.position.clone(),
    toCamera: toTarget.clone().add(offset),
  };

  // Walk to that bed's outside corner of the path, nearest where you are looking
  // from, if you aren't there already.
  const mine = figures.get(me);
  if (mine && bedOf(mine.target) !== bed) {
    walkTo(nearestLoopU(centre.x + outX * 10, centre.z + outZ * 10, bed));
  }
}

function updateGlide(now) {
  if (!glide) return;
  const t = Math.min(1, (now - glide.start) / BED_GLIDE_MS);
  const eased = t * t * (3 - 2 * t);
  controls.target.lerpVectors(glide.fromTarget, glide.toTarget, eased);
  camera.position.lerpVectors(glide.fromCamera, glide.toCamera, eased);
  if (t >= 1) glide = null;
}

const picker = document.getElementById("plant-picker");
const pickerButtons = [...picker.querySelectorAll("[data-type]")];

function setSelectedType(type, remember) {
  selectedType = type;
  for (const button of pickerButtons) {
    button.setAttribute("aria-checked", String(button.dataset.type === type));
  }
  if (remember) {
    try {
      localStorage.setItem("plantType", type);
    } catch {
      // storage blocked: the choice just lasts until the page is reloaded
    }
  }
  if (hoveredPosition !== null) refreshStatusBarForHover(plots.get(hoveredPosition));
}

picker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-type]");
  if (button) setSelectedType(button.dataset.type, true);
});
setSelectedType(selectedType, false);

function applyPlot(plot) {
  const prev = plots.get(plot.position);
  const stateChanged = !prev || prev.state !== plot.state || prev.plantType !== plot.plantType;
  const wateredChanged =
    Boolean(prev) && plot.lastWateredAt !== null && (prev.lastWateredAt === null || plot.lastWateredAt > prev.lastWateredAt);

  // What someone just did, read from how the plot changed. Nothing on the first
  // snapshot, and nothing when a plot merely grew or wilted by itself.
  let action = null;
  if (prev) {
    if (prev.state === "empty" && plot.state !== "empty") action = "plant";
    else if (prev.state !== "empty" && plot.state === "empty") action = "compost";
    else if (wateredChanged) action = "water";
  }

  plots.set(plot.position, plot);
  if (stateChanged) rebuildPlant(plot.position, plot.plantType ?? "tree", plot.state);
  if (wateredChanged) triggerWaterEffect(plot.position, plot.lastWateredBy);
  if (action) showActionBadge(plot.position, action, plot.lastWateredBy);
  if (hoveredPosition === plot.position) refreshStatusBarForHover(plot);
}

// Little gardeners: one figure for each gardener online, walking along the loop
// round the bed and never on the plots. A figure's place is only for show: it
// limits nothing anyone can do to a plot. The server only relays where a figure
// is and where it is going; each browser does the walking itself, so there is no
// per-frame traffic and two browsers can differ by a fraction of a second.
const WALK_UNITS = 1.5; // world units a second, about a lap of one bed in 18s
const figures = new Map(); // public id -> { group, u, target, heading, phase, ... }

const FIGURE_BODY = new THREE.CylinderGeometry(0.1, 0.15, 0.42, 8);
const FIGURE_HEAD = new THREE.SphereGeometry(0.12, 8, 6);
const FIGURE_BRIM = new THREE.CylinderGeometry(0.23, 0.23, 0.02, 10);
const FIGURE_CROWN = new THREE.CylinderGeometry(0.1, 0.13, 0.1, 8);
const FIGURE_SHADOW = new THREE.CircleGeometry(0.2, 12);
const FIGURE_MARKER = new THREE.ConeGeometry(0.08, 0.16, 6).rotateX(Math.PI);
// An arm hangs from its shoulder, so it is drawn downwards from the pivot.
const FIGURE_ARM = new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6).translate(0, -0.11, 0);
const FIGURE_HAND = new THREE.SphereGeometry(0.05, 6, 4);
const ARM_REST = 0.15;
const WAVE_MS = 2000;
const WAVE_RING = new THREE.RingGeometry(0.25, 0.3, 40);
const baseSkinMaterial = flatMaterial(0xf2c9a0);
const baseStrawMaterial = flatMaterial(0xe8c872);
const baseShadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false });

// Someone who hasn't moved, waved or tended a plot for a while fades to a ghost
// of their figure, so you can tell who is busy in the garden from who has left a
// tab open. Anything they do brings them straight back. Like the rest of a
// figure it is only for show, and only this browser works it out.
const IDLE_MS = 2 * 60 * 1000;
const IDLE_OPACITY = 0.35;

function createFigure(id, u) {
  const group = new THREE.Group();
  const bodyMaterial = flatMaterial(colourFor(id));
  // Every other figure gets its own copies of the shared materials, so it can fade
  // on its own. Yours never fades: you know you are here.
  const fades = id !== me;
  const skinMaterial = fades ? baseSkinMaterial.clone() : baseSkinMaterial;
  const strawMaterial = fades ? baseStrawMaterial.clone() : baseStrawMaterial;
  const shadowMaterial = fades ? baseShadowMaterial.clone() : baseShadowMaterial;
  const body = new THREE.Mesh(FIGURE_BODY, bodyMaterial);
  body.position.y = 0.21;
  const head = new THREE.Mesh(FIGURE_HEAD, skinMaterial);
  head.position.y = 0.54;
  const brim = new THREE.Mesh(FIGURE_BRIM, strawMaterial);
  brim.position.y = 0.64;
  const crown = new THREE.Mesh(FIGURE_CROWN, strawMaterial);
  crown.position.y = 0.7;
  const shadow = new THREE.Mesh(FIGURE_SHADOW, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  group.add(body, head, brim, crown, shadow);

  // Two arms hanging at the sides. The right one is the one that waves.
  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, 0.4, 0);
    pivot.rotation.z = side * ARM_REST;
    const sleeve = new THREE.Mesh(FIGURE_ARM, bodyMaterial);
    const hand = new THREE.Mesh(FIGURE_HAND, skinMaterial);
    hand.position.y = -0.24;
    pivot.add(sleeve, hand);
    return pivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);
  group.add(leftArm, rightArm);

  const ownMaterials = fades ? [bodyMaterial, skinMaterial, strawMaterial, shadowMaterial] : [bodyMaterial];
  // What each faded material goes back to: the shadow is always see-through.
  const fadeMaterials = fades ? ownMaterials.map((material) => ({ material, full: material.opacity })) : [];
  let marker = null;
  if (id === me) {
    // A little gold arrow bobbing over your own figure, so you can find yourself.
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffd23f });
    marker = new THREE.Mesh(FIGURE_MARKER, markerMaterial);
    marker.position.y = 1.05;
    group.add(marker);
    ownMaterials.push(markerMaterial);
  }

  scene.add(group);
  const figure = {
    group,
    body,
    rightArm,
    waveStart: null,
    marker,
    ownMaterials,
    fadeMaterials,
    fade: 1,
    lastActive: performance.now(),
    u,
    target: u,
    heading: 1,
    // Set while walking the walkway to the other bed: { to, progress from 0 to 1 }.
    crossing: null,
    phase: Math.random() * 6.28,
  };
  figures.set(id, figure);
  return figure;
}

function removeFigure(id) {
  const figure = figures.get(id);
  if (!figure) return;
  scene.remove(figure.group);
  for (const material of figure.ownMaterials) material.dispose();
  figures.delete(id);
}

// Someone did something: moved, waved or tended a plot.
function markActive(id) {
  const figure = figures.get(id);
  if (figure) figure.lastActive = performance.now();
}

// Eases a figure towards fully there or faded. A material only becomes
// see-through while it is fading, so a figure at full strength draws as before.
function updateFade(figure, now, dt) {
  if (figure.fadeMaterials.length === 0) return;
  const target = now - figure.lastActive > IDLE_MS ? IDLE_OPACITY : 1;
  if (figure.fade === target) return;
  const step = Math.min(1, dt * 2.5);
  figure.fade += (target - figure.fade) * step;
  if (Math.abs(target - figure.fade) < 0.005) figure.fade = target;
  for (const { material, full } of figure.fadeMaterials) {
    const transparent = full < 1 || figure.fade < 1;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.opacity = full * figure.fade;
  }
}

// Shortest way round one bed's loop from a to b, both on the same bed, as a
// fraction of that loop: -0.5 up to but not including 0.5.
function alongDifference(a, b) {
  return ((alongLoop(b) - alongLoop(a) + 1.5) % 1) - 0.5;
}

// How far apart two spots are for a figure, in world units, counting the walk
// round each bed to its walkway and across, bed by bed, when they are at different
// beds. Used to tell when a figure has drifted too far from where the server says.
function walkDistance(a, b) {
  let distance = 0;
  let here = a;
  while (bedOf(here) !== bedOf(b)) {
    const step = walkwayBetween(bedOf(here), nextBedTowards(bedOf(here), bedOf(b)));
    distance += Math.abs(alongDifference(here, step.startU)) * LOOP_LENGTH + step.walkway.length;
    here = step.endU;
  }
  return distance + Math.abs(alongDifference(here, b)) * LOOP_LENGTH;
}

// One frame's walk for a figure. Round its own bed it takes the shorter way. To
// reach another bed it goes bed by bed the shorter way round the square: round to
// the walkway, across it, and on. Every browser works out the same walk from the
// same u and target, so nothing extra goes to the server. Returns where it stands.
function stepFigure(figure, dt) {
  let budget = WALK_UNITS * dt;

  // Partway across a walkway: keep going, then step onto the far loop.
  if (figure.crossing) {
    const crossing = figure.crossing;
    crossing.progress = Math.min(1, crossing.progress + budget / crossing.walkway.length);
    if (crossing.progress >= 1) {
      figure.crossing = null;
      figure.u = crossing.endU;
    }
    const dx = crossing.end.x - crossing.start.x;
    const dz = crossing.end.z - crossing.start.z;
    const point = { x: crossing.start.x + dx * crossing.progress, z: crossing.start.z + dz * crossing.progress };
    return { walking: true, point, direction: { x: dx, z: dz } };
  }

  // Going to another bed: first round to this bed's end of the next walkway.
  const otherBed = bedOf(figure.target) !== bedOf(figure.u);
  const step = otherBed ? walkwayBetween(bedOf(figure.u), nextBedTowards(bedOf(figure.u), bedOf(figure.target))) : null;
  const goal = step ? step.startU : figure.target;
  const diff = alongDifference(figure.u, goal);
  if (Math.abs(diff) <= 0.0005) {
    if (step) {
      figure.crossing = { ...step, progress: 0 };
      return stepFigure(figure, dt);
    }
    return { walking: false, point: loopPoint(figure.u), direction: null };
  }

  figure.heading = Math.sign(diff);
  const move = Math.min(Math.abs(diff), budget / LOOP_LENGTH);
  figure.u = toU(bedOf(figure.u), alongLoop(figure.u) + figure.heading * move);
  const point = loopPoint(figure.u);
  const ahead = loopPoint(toU(bedOf(figure.u), alongLoop(figure.u) + figure.heading * 0.002));
  return { walking: true, point, direction: { x: ahead.x - point.x, z: ahead.z - point.z } };
}

function setGardener(gardener) {
  const existing = figures.get(gardener.id);
  // Your own figure is yours to move: an echo of an earlier click arriving after
  // a later one would only make it jerk back.
  if (existing && gardener.id === me) return;

  const figure = existing ?? createFigure(gardener.id, gardener.u);
  // A move is a sign of life, but the list sent on joining is not: it would wake
  // every faded figure each time someone new arrived.
  if (existing && figure.target !== gardener.target) figure.lastActive = performance.now();
  figure.target = gardener.target;
  // If this browser has drifted well away from where the server says the figure
  // is, put it there. Not while it is crossing the walkway: it is on its way.
  if (existing && !figure.crossing && walkDistance(figure.u, gardener.u) > 0.8) figure.u = gardener.u;
}

function setPresence(gardeners) {
  const here = new Set(gardeners.map((gardener) => gardener.id));
  for (const id of [...figures.keys()]) if (!here.has(id)) removeFigure(id);
  for (const gardener of gardeners) setGardener(gardener);
  renderWhoIsHere();
}

const whoDots = document.getElementById("who-dots");
const whoCount = document.getElementById("who-count");

function renderWhoIsHere() {
  const ids = [...figures.keys()].sort((a, b) => (a === me ? -1 : b === me ? 1 : a.localeCompare(b)));
  whoDots.replaceChildren(
    ...ids.map((id) => {
      const dot = document.createElement("span");
      dot.className = id === me ? "chip chip-you" : "chip";
      dot.style.background = `#${colourFor(id).getHexString()}`;
      dot.title = id === me ? "You" : "Another gardener";
      return dot;
    }),
  );
  const others = ids.length - (figures.has(me) ? 1 : 0);
  whoCount.textContent =
    others === 0 ? "Just you here" : `You and ${others} other gardener${others === 1 ? "" : "s"}`;
}

let lastFigureTime = performance.now();

function updateFigures(now) {
  const dt = Math.min((now - lastFigureTime) / 1000, 0.1);
  lastFigureTime = now;
  const t = now / 1000;

  for (const figure of figures.values()) {
    const { walking, point: here, direction } = stepFigure(figure, dt);
    if (direction) figure.group.rotation.y = Math.atan2(direction.x, direction.z);
    // A little bounce and sway while walking, standing still on arriving.
    const step = Math.sin(t * 10 + figure.phase);
    figure.group.position.set(here.x, PATH_TOP + (walking ? Math.abs(step) * 0.05 : 0), here.z);
    figure.body.rotation.z = walking ? step * 0.08 : 0;
    if (figure.marker) figure.marker.position.y = 1.05 + Math.sin(t * 3) * 0.05;
    updateFade(figure, now, dt);

    // A wave: the right arm lifts quickly, swings for a while and drops again.
    if (figure.waveStart !== null) {
      const w = (now - figure.waveStart) / WAVE_MS;
      if (w >= 1) {
        figure.waveStart = null;
        figure.rightArm.rotation.z = ARM_REST;
      } else {
        const lift = Math.min(w / 0.12, (1 - w) / 0.12, 1);
        figure.rightArm.rotation.z = ARM_REST + lift * (2.3 + 0.4 * Math.sin(t * 14));
      }
    }
  }
}

// A wave also sends a soft ring out across the path from the figure, in the
// gardener's colour, so you notice it from across the garden. Like the drops and
// the badges it has its own material, which goes when the ring does.
const waveRings = [];

function waveFigure(id) {
  const figure = figures.get(id);
  if (!figure) return;

  figure.waveStart = performance.now();
  figure.lastActive = figure.waveStart;
  const material = new THREE.MeshBasicMaterial({
    color: colourFor(id),
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(WAVE_RING, material);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  figure.group.add(ring);
  waveRings.push({ ring, material, parent: figure.group, start: figure.waveStart });
}

function updateWaveRings(now) {
  for (let i = waveRings.length - 1; i >= 0; i--) {
    const wave = waveRings[i];
    const t = (now - wave.start) / (WAVE_MS * 0.9);
    if (t >= 1) {
      wave.parent.remove(wave.ring);
      wave.material.dispose();
      waveRings.splice(i, 1);
      continue;
    }
    wave.ring.scale.setScalar(1 + 3.5 * t);
    wave.material.opacity = 0.8 * (1 - t);
  }
}

// Tell the others where your figure is and where it is going. The server drops
// anything faster than about one a tenth of a second, so hold back until then.
let lastPresenceSent = 0;
let presenceTimer = null;

function sendPresence() {
  const mine = figures.get(me);
  if (!mine) return;
  const wait = 110 - (Date.now() - lastPresenceSent);
  if (wait > 0) {
    if (!presenceTimer) {
      presenceTimer = setTimeout(() => {
        presenceTimer = null;
        sendPresence();
      }, wait);
    }
    return;
  }
  lastPresenceSent = Date.now();
  fetch("/api/presence", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Partway across the walkway the figure isn't on either loop, so say it is at
    // the end it is heading for: others see at most a small jump.
    body: JSON.stringify({ u: mine.crossing ? mine.crossing.endU : mine.u, target: mine.target }),
  }).catch(() => {});
}

function walkTo(u) {
  const mine = figures.get(me);
  if (!mine) return;
  mine.target = u;
  sendPresence();
}

// Your own panel: your colour and a plain record of what you have done. The
// record comes from the server and is only ever sent to you.
const youChip = document.getElementById("you-chip");
const youSince = document.getElementById("you-since");
const countElements = {
  planted: document.getElementById("count-planted"),
  watered: document.getElementById("count-watered"),
  composted: document.getElementById("count-composted"),
};

function renderYou() {
  if (me) youChip.style.background = `#${colourFor(me).getHexString()}`;
}

function renderStats(stats) {
  for (const [name, element] of Object.entries(countElements)) element.textContent = String(stats[name]);
  youSince.textContent =
    stats.since === null
      ? "Your record starts with your first action"
      : `Tending since ${new Date(stats.since).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

// The recent list: the last few things gardeners did, newest first. The server
// keeps and sends it; this only draws it. It shows no counts and no totals.
const FEED_LENGTH = 4;
const feedList = document.getElementById("feed-list");
const feedEmpty = document.getElementById("feed-empty");
let feed = [];

function feedText(entry) {
  const who = entry.id === me ? "You" : "A gardener";
  if (entry.did === "plant") {
    const name = PLANT_NAME[entry.type ?? "tree"].toLowerCase();
    return `${who} planted a ${name}`;
  }
  if (entry.did === "water") return `${who} watered a plant`;
  return `${who} composted a wilted plant`;
}

function renderFeed() {
  feedList.replaceChildren(
    ...feed.map((entry) => {
      const item = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "chip";
      dot.style.background = `#${colourFor(entry.id).getHexString()}`;
      item.append(dot, feedText(entry));
      return item;
    }),
  );
  feedEmpty.hidden = feed.length > 0;
}

function connect() {
  const source = new EventSource("/events");
  source.addEventListener("hello", (event) => {
    const hello = JSON.parse(event.data);
    me = hello.you;
    wiltWindowMs = hello.wiltWindowMs;
    dayLengthMs = hello.dayLengthMs;
    clockOffset = hello.serverNow - Date.now();
    renderYou();
  });
  source.addEventListener("snapshot", (event) => {
    for (const plot of JSON.parse(event.data)) applyPlot(plot);
  });
  source.addEventListener("update", (event) => {
    applyPlot(JSON.parse(event.data));
  });
  source.addEventListener("presence", (event) => setPresence(JSON.parse(event.data)));
  source.addEventListener("presence-update", (event) => {
    setGardener(JSON.parse(event.data));
    renderWhoIsHere();
  });
  source.addEventListener("presence-leave", (event) => {
    removeFigure(JSON.parse(event.data).id);
    renderWhoIsHere();
  });
  source.addEventListener("wave", (event) => waveFigure(JSON.parse(event.data).id));
  source.addEventListener("stats", (event) => renderStats(JSON.parse(event.data)));
  source.addEventListener("feed", (event) => {
    feed = JSON.parse(event.data).slice(0, FEED_LENGTH);
    renderFeed();
  });
  source.addEventListener("activity", (event) => {
    const activity = JSON.parse(event.data);
    markActive(activity.id);
    feed = [activity, ...feed].slice(0, FEED_LENGTH);
    renderFeed();
  });
}
connect();

// The Wave button. The server drops a wave sent too soon after the last, so grey
// the button out for about as long, and let the event, not the reply, show it.
const waveButton = document.getElementById("wave-button");
waveButton.addEventListener("click", () => {
  waveButton.disabled = true;
  setTimeout(() => {
    waveButton.disabled = false;
  }, 1500);
  fetch("/api/wave", { method: "POST" }).catch(() => {});
});

const raycaster = new THREE.Raycaster();
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);

function ndcFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

async function handlePointerClick(event) {
  raycaster.setFromCamera(ndcFromEvent(event), camera);
  const hit = raycaster.intersectObjects(soilMeshes, false)[0];
  if (!hit) {
    // Not a plot: a click on the grass or the path sends your figure to the
    // nearest point on the path, or over to the other bed if it is nearer that.
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(GROUND_PLANE, point)) return;
    const bed = bedAreaAt(point.x, point.z);
    if (bed !== null && bed !== currentBed) goToBed(bed);
    else walkTo(nearestLoopU(point.x, point.z, currentBed));
    return;
  }

  const position = hit.object.userData.position;
  // A plot in the bed you aren't at takes you there, rather than acting on it
  // from across the garden.
  if (bedOfPosition(position) !== currentBed) {
    goToBed(bedOfPosition(position));
    return;
  }
  // Clicking a plot still acts on it, and your figure walks round to the path
  // beside it, where others can watch you tend it.
  const plotSpot = worldPosition(position);
  walkTo(nearestLoopU(plotSpot.x, plotSpot.z, currentBed));
  const state = plots.get(position)?.state ?? "empty";
  const action = actionFor(state);

  try {
    const res =
      action === "plant"
        ? await fetch(`/api/plots/${position}/plant`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: selectedType }),
          })
        : await fetch(`/api/plots/${position}/${action}`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      showStatusMessage(body.error ?? "That action isn't valid for this plot right now.");
    }
  } catch {
    showStatusMessage("Couldn't reach the server — try again.");
  }
}

let downX = 0;
let downY = 0;
renderer.domElement.addEventListener("pointerdown", (event) => {
  downX = event.clientX;
  downY = event.clientY;
});
renderer.domElement.addEventListener("pointerup", (event) => {
  const dist = Math.hypot(event.clientX - downX, event.clientY - downY);
  if (dist < 6) handlePointerClick(event);
});

// Which other bed the pointer is over, if any, so it can be offered as a place
// to go. null when the pointer is over the bed you are at, or nowhere near.
let hoveredBed = null;

// A sign over each bed you aren't at. Clicking one, or its bed, takes you there.
// The page has one sign as a template; each bed gets its own copy.
const signTemplate = document.getElementById("bed-sign");
const bedSigns = BED_CENTRES.map((_, bed) => {
  const sign = signTemplate.cloneNode(true);
  sign.removeAttribute("id");
  sign.dataset.bed = String(bed);
  const label = `Go to ${BED_NAMES[bed]}`;
  sign.querySelector(".bed-sign-label").textContent = label;
  sign.setAttribute("aria-label", label);
  sign.addEventListener("click", () => goToBed(bed));
  sign.addEventListener("pointerenter", () => setHoveredBed(bed));
  sign.addEventListener("pointerleave", () => setHoveredBed(null));
  signTemplate.after(sign);
  return sign;
});
signTemplate.remove();
const signPoint = new THREE.Vector3();

function setHoveredBed(bed) {
  if (bed === hoveredBed) return;
  hoveredBed = bed;
  renderer.domElement.style.cursor = bed === null ? "" : "pointer";
  bedSigns.forEach((sign, i) => sign.classList.toggle("is-hovered", i === bed));
  bedBases.forEach((base, i) => {
    base.material.emissive.setHex(i === bed ? 0x3a2a14 : 0x000000);
  });
}

// Keep each sign over its bed as the view moves, and hide it for the bed you are
// at, while gliding, and when its bed is behind the camera or off the screen.
function updateBedSigns() {
  const rect = renderer.domElement.getBoundingClientRect();
  bedSigns.forEach((sign, bed) => {
    const centre = BED_CENTRES[bed];
    signPoint.set(centre.x, BED_SIGN_HEIGHT, centre.z).project(camera);
    const x = rect.left + ((signPoint.x + 1) / 2) * rect.width;
    const y = rect.top + ((1 - signPoint.y) / 2) * rect.height;
    const visible =
      bed !== currentBed && !glide && signPoint.z < 1 && x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
    if (sign.hidden === visible) sign.hidden = !visible;
    if (!visible) return;
    sign.style.left = `${x}px`;
    sign.style.top = `${y}px`;
  });
}

function clearHoveredPlot() {
  if (hoveredPosition !== null) sceneObjects.get(hoveredPosition).soilMesh.scale.set(1, 1, 1);
  hoveredPosition = null;
}

renderer.domElement.addEventListener("pointermove", (event) => {
  raycaster.setFromCamera(ndcFromEvent(event), camera);
  const hit = raycaster.intersectObjects(soilMeshes, false)[0];
  let position = hit ? hit.object.userData.position : null;

  // Over the other bed, or the grass and path round it: offer to go there.
  let otherBed = null;
  if (position !== null && bedOfPosition(position) !== currentBed) {
    otherBed = bedOfPosition(position);
    position = null;
  } else if (position === null) {
    const point = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(GROUND_PLANE, point)) {
      const bed = bedAreaAt(point.x, point.z);
      if (bed !== null && bed !== currentBed) otherBed = bed;
    }
  }

  if (otherBed !== null) {
    clearHoveredPlot();
    setHoveredBed(otherBed);
    return;
  }
  const wasOverBed = hoveredBed !== null;
  setHoveredBed(null);
  if (position === hoveredPosition && !wasOverBed) return;

  clearHoveredPlot();
  hoveredPosition = position;
  if (position !== null) {
    sceneObjects.get(position).soilMesh.scale.set(1, 1.25, 1);
    refreshStatusBarForHover(plots.get(position));
  } else {
    clearStatusBarHover();
  }
});

renderer.domElement.addEventListener("pointerleave", () => {
  clearHoveredPlot();
  setHoveredBed(null);
  clearStatusBarHover();
});

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  updateGlide(now);
  controls.update();
  updateBedSigns();
  tickAnimations(now);
  updateRings(now);
  updateSky();
  updateClouds(serverNow() / 1000);
  updateInsects(serverNow() / 1000);
  updateDrops(now);
  updateBadges(now);
  updateFigures(now);
  updateWaveRings(now);
  renderer.render(scene, camera);
}
animate();
