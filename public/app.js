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

const PLANT_TYPES = ["tree", "flower", "sunflower", "shrub", "vegetable", "tomato", "lettuce", "strawberry", "blueberry", "lavender", "rosemary", "foxglove"];

const PLANT_NAME = { tree: "Apple tree", flower: "Tulip", sunflower: "Sunflower", shrub: "Flower shrub", vegetable: "Carrot", tomato: "Tomato", lettuce: "Lettuce", strawberry: "Strawberry", blueberry: "Blueberry", lavender: "Lavender", rosemary: "Rosemary", foxglove: "Foxglove" };

// The same four growth stages mean different things for each plant.
const STAGE_LABEL = {
  tree: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "fruiting" },
  flower: { planted: "just planted", sprout: "sprouting", growing: "budding", mature: "in bloom" }, // the tulip
  sunflower: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "in bloom" },
  shrub: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "in flower" },
  vegetable: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "ready to pick" }, // the carrot
  tomato: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "ripe" },
  lettuce: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "ready to pick" },
  strawberry: { planted: "just planted", sprout: "sprouting", growing: "flowering", mature: "ripe" },
  blueberry: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "ripe" },
  lavender: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "in bloom" },
  rosemary: { planted: "just planted", sprout: "sprouting", growing: "growing", mature: "in flower" },
  foxglove: { planted: "just planted", sprout: "sprouting", growing: "budding", mature: "in bloom" },
};

const PALETTE = {
  soilDry: 0xc9a876,
  soilRich: 0x6b4a34,
  soilWilted: 0x9c8769,
  seedTree: 0x3f7d32,
  seedFlower: 0xb5835a,
  seedShrub: 0x5f8f4a,
  seedSunflower: 0x4a4038,
  seedVegetable: 0xc9a36b,
  seedTomato: 0xe3d3a0,
  seedLettuce: 0x7a6a4a,
  stemSprout: 0x6a9b46,
  foliageSprout: 0x8fc45f,
  trunk: 0x6b4423,
  foliageTree: 0x5a9c48,
  foliageTreeLight: 0x6fb05a,
  fruit: 0xd42a2a,
  flowerStem: 0x5fa04b,
  flowerLeaf: 0x7cc063,
  flowerBud: 0xa8d672,
  tulip: 0xe8445a,
  tulipDeep: 0xc42f4a,
  sunPetal: 0xffd21f,
  sunPetalDeep: 0xf7b500,
  sunCentre: 0x5a3a1e,
  shrubLeaf: 0x4f9e5a,
  shrubLeafLight: 0x6bb36e,
  shrubBloomPink: 0xf58fb9,
  shrubBloomWhite: 0xfff3fa,
  vegTop: 0x4f9e3a,
  vegTopLight: 0x78bf4a,
  carrot: 0xe8873a,
  tomatoRed: 0xe0392b,
  tomatoGreen: 0x8fbf4a,
  tomatoVine: 0x3f8f3a,
  stake: 0x8a6b4f,
  lettuce: 0x8fd14f,
  lettuceDeep: 0x5fae3a,
  lettuceLight: 0xb7e57a,
  strawberryRed: 0xe5304f,
  strawberryLeaf: 0x4a9a3e,
  strawberryBlossom: 0xfff6f0,
  blueberryBlue: 0x3f55c8,
  blueberryLeaf: 0x5aa860,
  blueberryLeafLight: 0x7cc47a,
  blueberryTwig: 0x6e4a2a,
  seedBerry: 0xb8a58a,
  lavenderLeaf: 0x8aa88a,
  lavender: 0xa98ae0,
  lavenderDeep: 0x8a5fd0,
  rosemaryLeaf: 0x3e6e4a,
  rosemaryLight: 0x5a8a5a,
  rosemaryBlue: 0x6a8fe0,
  foxglovePink: 0xd96aa8,
  foxgloveDeep: 0xb8408a,
  foxgloveLeaf: 0x5a9a4a,
  hedge: 0x2a5e30,
  hedgeMid: 0x3a7d40,
  hedgeLight: 0x4a9150,
  rose: 0xf06a8a,
  roseDeep: 0xd0406a,
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

const SEED_COLOUR = {
  flower: PALETTE.seedFlower,
  sunflower: PALETTE.seedSunflower,
  shrub: PALETTE.seedShrub,
  vegetable: PALETTE.seedVegetable,
  tomato: PALETTE.seedTomato,
  lettuce: PALETTE.seedLettuce,
  strawberry: PALETTE.seedBerry,
  blueberry: PALETTE.seedBerry,
  lavender: 0x7a6a5a,
  rosemary: 0x6a5a40,
  foxglove: 0x8a7a6a,
};

function buildSeeds(type) {
  const group = new THREE.Group();
  const colour = SEED_COLOUR[type] ?? PALETTE.seedTree;
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
  } else if (type === "sunflower") {
    // Two fat seed leaves on a thick little stem.
    group.add(part(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 6), PALETTE.flowerStem, 0, 0.1, 0));
    for (const side of [-1, 1]) {
      const leaf = part(new THREE.SphereGeometry(0.07, 6, 4), PALETTE.flowerLeaf, side * 0.08, 0.2, 0);
      leaf.scale.set(1, 0.35, 0.7);
      group.add(leaf);
    }
  } else if (type === "shrub") {
    group.add(part(new THREE.SphereGeometry(0.1, 6, 5), PALETTE.shrubLeaf, -0.05, 0.08, 0));
    group.add(part(new THREE.SphereGeometry(0.08, 6, 5), PALETTE.shrubLeafLight, 0.07, 0.07, 0.03));
  } else if (type === "tomato") {
    group.add(part(new THREE.CylinderGeometry(0.02, 0.025, 0.2, 6), PALETTE.tomatoVine, 0, 0.1, 0));
    for (const side of [-1, 1]) {
      const leaf = part(new THREE.SphereGeometry(0.055, 6, 4), PALETTE.vegTopLight, side * 0.06, 0.2, 0);
      leaf.scale.set(1, 0.4, 0.8);
      group.add(leaf);
    }
  } else if (type === "strawberry") {
    // Three small toothed leaves low on the soil.
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leaf = part(new THREE.SphereGeometry(0.055, 6, 4), PALETTE.strawberryLeaf, Math.cos(angle) * 0.05, 0.05, Math.sin(angle) * 0.05);
      leaf.scale.set(1, 0.35, 0.9);
      group.add(leaf);
    }
  } else if (type === "blueberry") {
    // A woody twig with two tiny leaves.
    group.add(part(new THREE.CylinderGeometry(0.014, 0.02, 0.2, 5), PALETTE.blueberryTwig, 0, 0.1, 0));
    for (const side of [-1, 1]) {
      const leaf = part(new THREE.SphereGeometry(0.045, 6, 4), PALETTE.blueberryLeaf, side * 0.05, 0.19, 0);
      leaf.scale.set(1, 0.45, 0.8);
      group.add(leaf);
    }
  } else if (type === "lavender") {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const blade = part(new THREE.ConeGeometry(0.018, 0.17, 4), PALETTE.lavenderLeaf, Math.cos(angle) * 0.04, 0.085, Math.sin(angle) * 0.04);
      blade.rotation.z = -Math.cos(angle) * 0.3;
      blade.rotation.x = Math.sin(angle) * 0.3;
      group.add(blade);
    }
  } else if (type === "rosemary") {
    group.add(part(new THREE.CylinderGeometry(0.014, 0.018, 0.14, 5), PALETTE.blueberryTwig, 0, 0.07, 0));
    for (const side of [-1, 1]) {
      const needles = part(new THREE.ConeGeometry(0.02, 0.12, 4), PALETTE.rosemaryLight, side * 0.03, 0.17, 0);
      needles.rotation.z = -side * 0.4;
      group.add(needles);
    }
  } else if (type === "foxglove") {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const leaf = part(new THREE.SphereGeometry(0.07, 6, 4), PALETTE.foxgloveLeaf, Math.cos(angle) * 0.06, 0.03, Math.sin(angle) * 0.06);
      leaf.scale.set(1, 0.25, 0.7);
      leaf.rotation.y = -angle;
      group.add(leaf);
    }
  } else if (type === "lettuce") {
    for (const side of [-1, 1]) {
      const leaf = part(new THREE.SphereGeometry(0.07, 6, 4), PALETTE.lettuceLight, side * 0.05, 0.05, 0);
      leaf.scale.set(1, 0.35, 0.8);
      group.add(leaf);
    }
  } else if (type === "vegetable") {
    // Two small feathery tufts just up out of the soil.
    for (const side of [-1, 1]) {
      const tuft = part(new THREE.ConeGeometry(0.035, 0.16, 4), PALETTE.vegTopLight, side * 0.05, 0.09, 0);
      tuft.rotation.z = -side * 0.35;
      group.add(tuft);
    }
  } else {
    group.add(part(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), PALETTE.stemSprout, 0, 0.12, 0));
    group.add(part(new THREE.SphereGeometry(0.12, 7, 5), PALETTE.foliageSprout, 0, 0.3, 0));
  }
  return group;
}

// An apple tree: a short trunk under a round crown of overlapping leaf balls. Once
// it is fruiting, red apples sit all over the outside of the crown.
const CROWN = [
  [0, 0.6, 0, 0.27],
  [0.17, 0.52, 0.06, 0.2],
  [-0.16, 0.53, -0.05, 0.2],
  [0.03, 0.5, -0.17, 0.19],
  [-0.03, 0.51, 0.17, 0.19],
  [0.02, 0.76, 0.02, 0.17],
];
function buildTree(mature) {
  const group = new THREE.Group();
  group.add(part(new THREE.CylinderGeometry(0.055, 0.08, 0.38, 7), PALETTE.trunk, 0, 0.19, 0));
  CROWN.forEach(([x, y, z, r], i) => {
    group.add(part(new THREE.SphereGeometry(r, 8, 6), i % 2 === 0 ? PALETTE.foliageTree : PALETTE.foliageTreeLight, x, y, z));
  });
  if (mature) {
    const apples = [[0.24, 0.5, 0.1], [-0.22, 0.58, 0.12], [0.05, 0.46, 0.27], [-0.1, 0.44, -0.24], [0.2, 0.62, -0.17], [-0.05, 0.74, 0.18], [0.13, 0.4, -0.2]];
    for (const [x, y, z] of apples) group.add(part(new THREE.SphereGeometry(0.06, 7, 5), PALETTE.fruit, x, y, z));
  }
  return group;
}

// A tulip: a plain stem with two long upright leaves and, in bloom, a rounded red
// cup with three petal tips. Its stored type is still `flower`, from before it
// was a tulip, so the plants already in the garden stay valid.
function buildTulip(mature) {
  const group = new THREE.Group();
  group.add(part(new THREE.CylinderGeometry(0.022, 0.028, 0.4, 6), PALETTE.flowerStem, 0, 0.2, 0));
  for (const side of [-1, 1]) {
    const leaf = part(new THREE.ConeGeometry(0.05, 0.3, 4), PALETTE.flowerLeaf, side * 0.06, 0.15, 0);
    leaf.rotation.z = -side * 0.3;
    leaf.scale.z = 0.5;
    group.add(leaf);
  }
  if (mature) {
    const cup = part(new THREE.SphereGeometry(0.085, 8, 6), PALETTE.tulip, 0, 0.47, 0);
    cup.scale.set(0.9, 1.3, 0.9);
    group.add(cup);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const tip = part(new THREE.ConeGeometry(0.04, 0.09, 4), PALETTE.tulipDeep, Math.cos(angle) * 0.045, 0.58, Math.sin(angle) * 0.045);
      tip.rotation.z = -Math.cos(angle) * 0.3;
      tip.rotation.x = Math.sin(angle) * 0.3;
      group.add(tip);
    }
  } else {
    const bud = part(new THREE.SphereGeometry(0.05, 6, 5), PALETTE.flowerBud, 0, 0.43, 0);
    bud.scale.y = 1.3;
    group.add(bud);
  }
  return group;
}

// A sunflower: tall and thick-stemmed with broad leaves. In bloom its big yellow
// head, with a dark centre, faces the front; before that it is a green bud.
function buildSunflower(mature) {
  const group = new THREE.Group();
  const height = mature ? 0.78 : 0.55;
  group.add(part(new THREE.CylinderGeometry(0.035, 0.045, height, 6), PALETTE.flowerStem, 0, height / 2, 0));
  for (const [side, y] of [[-1, 0.2], [1, 0.34]]) {
    const leaf = part(new THREE.SphereGeometry(0.1, 6, 4), PALETTE.flowerLeaf, side * 0.11, y, 0);
    leaf.scale.set(1, 0.3, 0.65);
    leaf.rotation.z = side * 0.4;
    group.add(leaf);
  }
  const head = new THREE.Group();
  head.position.set(0, height + 0.02, 0.04);
  head.rotation.x = 1.2;
  if (mature) {
    // Each petal is laid along the head's face and turned round to its place.
    const petals = 13;
    for (let i = 0; i < petals; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / petals) * Math.PI * 2;
      const petal = part(
        new THREE.SphereGeometry(0.075, 8, 6),
        i % 2 === 0 ? PALETTE.sunPetal : PALETTE.sunPetalDeep,
        0.2,
        0,
        0,
      );
      petal.scale.set(1.9, 0.3, 1.05);
      pivot.add(petal);
      head.add(pivot);
    }
    head.add(part(new THREE.CylinderGeometry(0.115, 0.115, 0.05, 10), PALETTE.sunCentre, 0, 0.01, 0));
  } else {
    head.add(part(new THREE.SphereGeometry(0.09, 6, 5), PALETTE.flowerBud, 0, 0, 0));
  }
  group.add(head);
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

// A carrot: a fan of feathery green leaves and, once it is ready to pick, the
// orange top of the root showing above the soil.
function buildVegetable(mature) {
  const group = new THREE.Group();
  const leaves = mature ? 7 : 5;
  const height = mature ? 0.34 : 0.24;
  for (let i = 0; i < leaves; i++) {
    const angle = (i / leaves) * Math.PI * 2;
    const leaf = part(
      new THREE.ConeGeometry(0.035, height, 4),
      i % 2 === 0 ? PALETTE.vegTop : PALETTE.vegTopLight,
      Math.cos(angle) * 0.05,
      height / 2 + 0.02,
      Math.sin(angle) * 0.05,
    );
    leaf.rotation.z = -Math.cos(angle) * 0.45;
    leaf.rotation.x = Math.sin(angle) * 0.45;
    group.add(leaf);
  }
  if (mature) {
    const root = part(new THREE.ConeGeometry(0.075, 0.16, 6), PALETTE.carrot, 0, 0.02, 0);
    root.rotation.x = Math.PI;
    group.add(root);
  }
  return group;
}

// A tomato: a vine tied to a wooden stake, with red fruit hanging on it once it is
// ripe and a few green ones before that.
function buildTomato(mature) {
  const group = new THREE.Group();
  const height = mature ? 0.62 : 0.42;
  group.add(part(new THREE.CylinderGeometry(0.014, 0.014, height + 0.1, 5), PALETTE.stake, 0.07, (height + 0.1) / 2, 0));
  group.add(part(new THREE.CylinderGeometry(0.02, 0.026, height, 6), PALETTE.tomatoVine, 0, height / 2, 0));
  const clumps = mature ? 4 : 3;
  for (let i = 0; i < clumps; i++) {
    const y = 0.12 + (i * (height - 0.14)) / clumps;
    const side = i % 2 === 0 ? -1 : 1;
    const leaf = part(new THREE.SphereGeometry(0.085, 6, 4), i % 2 === 0 ? PALETTE.vegTop : PALETTE.vegTopLight, side * 0.08, y, 0.02);
    leaf.scale.set(1, 0.5, 0.8);
    group.add(leaf);
  }
  const fruit = mature ? [[-0.1, 0.22, 0.05], [0.04, 0.32, 0.07], [-0.07, 0.42, -0.03], [0.09, 0.17, -0.04]] : [[-0.07, 0.2, 0.05], [0.05, 0.3, 0.05]];
  for (const [x, y, z] of fruit) {
    group.add(part(new THREE.SphereGeometry(mature ? 0.052 : 0.032, 7, 5), mature ? PALETTE.tomatoRed : PALETTE.tomatoGreen, x, y, z));
  }
  return group;
}

// A lettuce: a low, ruffled head of overlapping leaves in rings, fuller and paler
// at the heart when it is ready to pick.
function buildLettuce(mature) {
  const group = new THREE.Group();
  const rings = mature ? 3 : 2;
  for (let ring = 0; ring < rings; ring++) {
    const count = 6 - ring;
    const radius = (mature ? 0.14 : 0.1) * (1 - ring * 0.32);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + ring * 0.5;
      const colour = ring === 0 ? PALETTE.lettuceDeep : ring === 1 ? PALETTE.lettuce : PALETTE.lettuceLight;
      const leaf = part(new THREE.SphereGeometry(mature ? 0.11 : 0.08, 7, 5), colour, Math.cos(angle) * radius, 0.07 + ring * 0.06, Math.sin(angle) * radius);
      leaf.scale.set(1, 0.6, 1);
      group.add(leaf);
    }
  }
  return group;
}

// A strawberry: a low spread of toothed leaves. White blossoms show while it grows
// and red berries sit on the leaves once it is ripe.
function buildStrawberry(mature) {
  const group = new THREE.Group();
  const leaves = mature ? 7 : 5;
  for (let i = 0; i < leaves; i++) {
    const angle = (i / leaves) * Math.PI * 2;
    const leaf = part(new THREE.SphereGeometry(0.09, 6, 4), PALETTE.strawberryLeaf, Math.cos(angle) * 0.11, 0.08, Math.sin(angle) * 0.11);
    leaf.scale.set(1, 0.4, 0.85);
    leaf.rotation.y = -angle;
    group.add(leaf);
  }
  group.add(part(new THREE.SphereGeometry(0.1, 7, 4), PALETTE.strawberryLeaf, 0, 0.1, 0));
  const spots = [[0.12, 0.17, 0.05], [-0.1, 0.16, 0.1], [0.02, 0.17, -0.13], [-0.06, 0.15, -0.06]];
  if (mature) {
    for (const [x, y, z] of spots) {
      const berry = part(new THREE.SphereGeometry(0.048, 7, 5), PALETTE.strawberryRed, x, y, z);
      berry.scale.y = 1.2;
      group.add(berry);
    }
  } else {
    for (const [x, y, z] of spots.slice(0, 3)) group.add(part(new THREE.SphereGeometry(0.03, 6, 4), PALETTE.strawberryBlossom, x, y + 0.02, z));
  }
  return group;
}

// A blueberry: a small rounded bush of woody twigs and dark leaves, with clusters
// of blue berries on it once it is ripe.
function buildBlueberry(mature) {
  const group = new THREE.Group();
  const size = mature ? 1 : 0.8;
  group.add(part(new THREE.CylinderGeometry(0.02, 0.03, 0.2, 5), PALETTE.blueberryTwig, 0, 0.1, 0));
  [[0, 0.3, 0, 0.2], [0.13, 0.24, 0.05, 0.14], [-0.12, 0.25, -0.04, 0.14], [0.02, 0.22, 0.14, 0.12]].forEach(([x, y, z, r], i) => {
    group.add(part(new THREE.SphereGeometry(r * size, 7, 5), i % 2 === 0 ? PALETTE.blueberryLeaf : PALETTE.blueberryLeafLight, x * size, y * size + 0.04, z * size));
  });
  if (mature) {
    // Berries sit on the outside of the bush so they show from above and the side.
    for (let i = 0; i < 16; i++) {
      const angle = i * 2.4;
      const radius = 0.15 + (i % 3) * 0.04;
      const y = 0.22 + (i % 5) * 0.05;
      group.add(part(new THREE.SphereGeometry(0.052, 7, 5), PALETTE.blueberryBlue, Math.cos(angle) * radius, y, Math.sin(angle) * radius));
    }
  }
  return group;
}

// Lavender: a low clump of grey-green leaves with thin stems rising from it. In
// bloom each stem ends in a long purple spike; before that it ends in a green bud.
function buildLavender(mature) {
  const group = new THREE.Group();
  const clump = part(new THREE.SphereGeometry(0.13, 7, 4), PALETTE.lavenderLeaf, 0, 0.06, 0);
  clump.scale.y = 0.6;
  group.add(clump);
  const stems = mature ? 9 : 6;
  for (let i = 0; i < stems; i++) {
    const angle = (i / stems) * Math.PI * 2 + 0.4;
    const height = (mature ? 0.4 : 0.26) + (i % 3) * 0.04;
    const lean = 0.18;
    const base = 0.04 + (i % 3) * 0.03;
    const stem = part(new THREE.CylinderGeometry(0.008, 0.011, height, 5), PALETTE.lavenderLeaf, Math.cos(angle) * base, height / 2 + 0.03, Math.sin(angle) * base);
    stem.rotation.z = -Math.cos(angle) * lean;
    stem.rotation.x = Math.sin(angle) * lean;
    group.add(stem);
    const topX = Math.cos(angle) * (base + height * lean);
    const topZ = Math.sin(angle) * (base + height * lean);
    if (mature) {
      const spike = part(new THREE.SphereGeometry(0.03, 6, 5), i % 2 === 0 ? PALETTE.lavender : PALETTE.lavenderDeep, topX, height + 0.04, topZ);
      spike.scale.y = 2.8;
      group.add(spike);
    } else {
      group.add(part(new THREE.SphereGeometry(0.018, 5, 4), PALETTE.lavenderLeaf, topX, height + 0.04, topZ));
    }
  }
  return group;
}

// Rosemary: a woody little bush of upright, needle-leaved sprigs, with tiny blue
// flowers along the tips once it is in flower.
function buildRosemary(mature) {
  const group = new THREE.Group();
  group.add(part(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 5), PALETTE.blueberryTwig, 0, 0.07, 0));
  const sprigs = mature ? 11 : 7;
  const height = mature ? 0.4 : 0.3;
  for (let i = 0; i < sprigs; i++) {
    const angle = i * 2.4;
    const radius = 0.03 + (i % 3) * 0.035;
    const sprig = part(new THREE.ConeGeometry(0.035, height, 4), i % 2 === 0 ? PALETTE.rosemaryLeaf : PALETTE.rosemaryLight, Math.cos(angle) * radius, height / 2 + 0.06, Math.sin(angle) * radius);
    sprig.rotation.z = -Math.cos(angle) * 0.22;
    sprig.rotation.x = Math.sin(angle) * 0.22;
    group.add(sprig);
    if (mature && i % 2 === 0) {
      const tipX = Math.cos(angle) * (radius + height * 0.22 * 0.8);
      const tipZ = Math.sin(angle) * (radius + height * 0.22 * 0.8);
      group.add(part(new THREE.SphereGeometry(0.026, 5, 4), PALETTE.rosemaryBlue, tipX, height * 0.8 + 0.08, tipZ));
    }
  }
  return group;
}

// A foxglove: a tall spire with a rosette of leaves at its foot. In bloom pink bells
// hang down the stem, biggest at the bottom and spiralling round; before that, only
// small buds at the top.
function buildFoxglove(mature) {
  const group = new THREE.Group();
  const height = mature ? 0.74 : 0.46;
  group.add(part(new THREE.CylinderGeometry(0.018, 0.028, height, 6), PALETTE.foxgloveLeaf, 0, height / 2, 0));
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.3;
    const leaf = part(new THREE.SphereGeometry(0.09, 6, 4), PALETTE.foxgloveLeaf, Math.cos(angle) * 0.08, 0.04, Math.sin(angle) * 0.08);
    leaf.scale.set(1, 0.25, 0.65);
    leaf.rotation.y = -angle;
    group.add(leaf);
  }
  if (mature) {
    const bells = 9;
    for (let i = 0; i < bells; i++) {
      const t = i / (bells - 1);
      const y = 0.26 + t * (height - 0.3);
      const angle = i * 2.2;
      const size = 1 - t * 0.5;
      const bell = part(new THREE.ConeGeometry(0.05 * size, 0.1 * size, 6), i % 2 === 0 ? PALETTE.foxglovePink : PALETTE.foxgloveDeep, Math.cos(angle) * 0.055, y, Math.sin(angle) * 0.055);
      bell.rotation.x = Math.PI;
      group.add(bell);
    }
    group.add(part(new THREE.SphereGeometry(0.022, 5, 4), PALETTE.foxglovePink, 0, height + 0.01, 0));
  } else {
    for (let i = 0; i < 4; i++) {
      const angle = i * 2.2;
      group.add(part(new THREE.SphereGeometry(0.028, 5, 4), PALETTE.foxgloveLeaf, Math.cos(angle) * 0.04, height - 0.02 - i * 0.045, Math.sin(angle) * 0.04));
    }
  }
  return group;
}

// wilted: a collapsed, drooping, brown version of whichever plant it was.
function buildWilted(type) {
  const group = new THREE.Group();
  if (type === "flower") {
    group.add(part(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 6), PALETTE.wiltedWood, 0, 0.16, 0));
    const cup = part(new THREE.SphereGeometry(0.06, 6, 5), PALETTE.wiltedFoliage, 0, 0.34, 0);
    cup.scale.y = 1.3;
    group.add(cup);
    group.rotation.z = 0.6;
  } else if (type === "sunflower") {
    group.add(part(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 6), PALETTE.wiltedWood, 0, 0.25, 0));
    group.add(part(new THREE.SphereGeometry(0.1, 6, 5), PALETTE.wiltedFoliage, 0.18, 0.4, 0));
    group.rotation.z = 0.5;
  } else if (type === "shrub") {
    const bush = part(new THREE.SphereGeometry(0.22, 7, 5), PALETTE.wiltedFoliage, 0, 0.12, 0);
    bush.scale.y = 0.5;
    group.add(bush);
    group.scale.setScalar(0.85);
  } else if (type === "tomato") {
    group.add(part(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5), PALETTE.stake, 0.07, 0.25, 0));
    group.add(part(new THREE.CylinderGeometry(0.02, 0.026, 0.3, 6), PALETTE.wiltedWood, 0, 0.15, 0));
    group.add(part(new THREE.SphereGeometry(0.045, 6, 4), PALETTE.wiltedFoliage, -0.1, 0.1, 0.03));
    group.rotation.z = 0.35;
  } else if (type === "strawberry") {
    for (let i = 0; i < 5; i++) {
      const leaf = part(new THREE.SphereGeometry(0.08, 6, 4), PALETTE.wiltedFoliage, Math.cos(i * 1.3) * 0.1, 0.03, Math.sin(i * 1.3) * 0.1);
      leaf.scale.set(1, 0.25, 0.9);
      group.add(leaf);
    }
  } else if (type === "blueberry") {
    group.add(part(new THREE.CylinderGeometry(0.02, 0.03, 0.22, 5), PALETTE.wiltedWood, 0, 0.11, 0));
    const bush = part(new THREE.SphereGeometry(0.17, 7, 5), PALETTE.wiltedFoliage, 0, 0.14, 0);
    bush.scale.y = 0.5;
    group.add(bush);
    group.rotation.z = 0.25;
  } else if (type === "lavender") {
    const clump = part(new THREE.SphereGeometry(0.13, 7, 4), PALETTE.wiltedFoliage, 0, 0.04, 0);
    clump.scale.y = 0.45;
    group.add(clump);
    for (let i = 0; i < 4; i++) {
      const stem = part(new THREE.CylinderGeometry(0.008, 0.01, 0.22, 4), PALETTE.wiltedWood, Math.cos(i * 1.6) * 0.07, 0.08, Math.sin(i * 1.6) * 0.07);
      stem.rotation.z = Math.cos(i * 1.6) * 1.1;
      stem.rotation.x = -Math.sin(i * 1.6) * 1.1;
      group.add(stem);
    }
  } else if (type === "rosemary") {
    group.add(part(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 5), PALETTE.wiltedWood, 0, 0.07, 0));
    const bush = part(new THREE.SphereGeometry(0.16, 7, 5), PALETTE.wiltedFoliage, 0, 0.14, 0);
    bush.scale.y = 0.5;
    group.add(bush);
    group.rotation.z = 0.2;
  } else if (type === "foxglove") {
    group.add(part(new THREE.CylinderGeometry(0.018, 0.028, 0.5, 6), PALETTE.wiltedWood, 0, 0.25, 0));
    for (let i = 0; i < 3; i++) {
      group.add(part(new THREE.SphereGeometry(0.03, 5, 4), PALETTE.wiltedFoliage, 0.04, 0.2 + i * 0.08, 0));
    }
    group.rotation.z = 0.55;
  } else if (type === "lettuce") {
    for (let i = 0; i < 5; i++) {
      const leaf = part(new THREE.SphereGeometry(0.1, 7, 4), PALETTE.wiltedFoliage, Math.cos(i * 1.3) * 0.1, 0.03, Math.sin(i * 1.3) * 0.1);
      leaf.scale.set(1, 0.25, 1);
      group.add(leaf);
    }
  } else if (type === "vegetable") {
    // The leaves flop over, brown.
    for (let i = 0; i < 4; i++) {
      const leaf = part(new THREE.ConeGeometry(0.035, 0.22, 4), PALETTE.wiltedFoliage, Math.cos(i * 1.6) * 0.05, 0.06, Math.sin(i * 1.6) * 0.05);
      leaf.rotation.z = Math.PI / 2 - 0.2;
      leaf.rotation.y = i * 1.6;
      group.add(leaf);
    }
  } else {
    group.add(part(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 7), PALETTE.wiltedWood, 0, 0.17, 0));
    const foliage = part(new THREE.SphereGeometry(0.3, 8, 6), PALETTE.wiltedFoliage, 0, 0.42, 0);
    foliage.scale.y = 0.55;
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
  if (type === "flower") return buildTulip(mature);
  if (type === "sunflower") return buildSunflower(mature);
  if (type === "shrub") return buildShrub(mature);
  if (type === "vegetable") return buildVegetable(mature);
  if (type === "tomato") return buildTomato(mature);
  if (type === "lettuce") return buildLettuce(mature);
  if (type === "strawberry") return buildStrawberry(mature);
  if (type === "blueberry") return buildBlueberry(mature);
  if (type === "lavender") return buildLavender(mature);
  if (type === "rosemary") return buildRosemary(mature);
  if (type === "foxglove") return buildFoxglove(mature);
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
// everything is blended. `sky` is the colour at the horizon, which the fog and the
// clouds also use; `mid` and `top` are the colours higher up, and `glow` is how
// much the sky shines round the sun.
const SKY_KEYS = [
  { at: 0.0, top: 0x03081c, mid: 0x0a1534, sky: 0x16244c, glow: 0, ambient: 0x7d8ad8, ambientI: 0.6, light: 0xa9bcff, lightI: 0.45, stars: 1 },
  { at: 0.19, top: 0x03081c, mid: 0x0a1534, sky: 0x16244c, glow: 0, ambient: 0x7d8ad8, ambientI: 0.6, light: 0xa9bcff, lightI: 0.45, stars: 1 },
  { at: 0.26, top: 0x3a5594, mid: 0xd98aa0, sky: 0xffb27a, glow: 1, ambient: 0xffd2b0, ambientI: 0.5, light: 0xffb27a, lightI: 0.6, stars: 0 },
  { at: 0.34, top: 0x4d9be0, mid: 0x9ccdee, sky: 0xd4eef6, glow: 0.12, ambient: 0xffffff, ambientI: 0.7, light: 0xfff4e0, lightI: 0.8, stars: 0 },
  { at: 0.66, top: 0x4d9be0, mid: 0x9ccdee, sky: 0xd4eef6, glow: 0.12, ambient: 0xffffff, ambientI: 0.7, light: 0xfff4e0, lightI: 0.8, stars: 0 },
  { at: 0.74, top: 0x35508f, mid: 0xd9708a, sky: 0xf59a52, glow: 1, ambient: 0xffc39a, ambientI: 0.5, light: 0xff9a5a, lightI: 0.6, stars: 0 },
  { at: 0.8, top: 0x151a44, mid: 0x4a3a7c, sky: 0xa8588a, glow: 0.45, ambient: 0x8a7bd1, ambientI: 0.42, light: 0xb39cff, lightI: 0.35, stars: 0.5 },
  { at: 0.86, top: 0x03081c, mid: 0x0a1534, sky: 0x16244c, glow: 0, ambient: 0x7d8ad8, ambientI: 0.6, light: 0xa9bcff, lightI: 0.45, stars: 1 },
  { at: 1.0, top: 0x03081c, mid: 0x0a1534, sky: 0x16244c, glow: 0, ambient: 0x7d8ad8, ambientI: 0.6, light: 0xa9bcff, lightI: 0.45, stars: 1 },
];

const SKY_DISTANCE = 25;

// Grass all round the bed, wide enough to reach the horizon. Fog in the sky's
// colour fades its far edge into the sky, so there's no visible rim.
const GROUND_Y = -0.46;
// A lawn texture: a base green with soft patches of lighter and darker green and a
// speckle of blades, tiled across the ground, so it does not read as one flat colour.
function lawnTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#78a854";
  ctx.fillRect(0, 0, size, size);
  const patch = (x, y, radius, colour) => {
    // Drawn again shifted by a full tile in each direction, so it wraps without a seam.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const gradient = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, radius);
        gradient.addColorStop(0, colour);
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(x + dx - radius, y + dy - radius, radius * 2, radius * 2);
      }
    }
  };
  for (let i = 0; i < 30; i++) {
    const light = seeded(i * 3 + 1) > 0.5;
    patch(seeded(i * 7 + 2) * size, seeded(i * 11 + 3) * size, 120 + seeded(i * 13 + 4) * 140, light ? "rgba(128,176,86,0.13)" : "rgba(104,152,76,0.13)");
  }
  for (let i = 0; i < 1500; i++) {
    const x = seeded(i * 5 + 7) * size;
    const y = seeded(i * 9 + 8) * size;
    const light = seeded(i * 17 + 9) > 0.45;
    ctx.fillStyle = light ? "rgba(132,180,90,0.12)" : "rgba(104,152,76,0.11)";
    ctx.fillRect(x, y, 1.5, 2 + seeded(i * 19 + 10) * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 26);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(80, 48),
  new THREE.MeshStandardMaterial({ map: lawnTexture(), roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = GROUND_Y;
scene.add(ground);
scene.fog = new THREE.Fog(0xd4eef6, 22, 60);

// The sky: a big dome round the camera, painted from the horizon colour up through a
// middle band to the top, with a warm glow near the sun, instead of one flat colour.
// The fog takes the horizon colour, so the far grass melts into the sky.
const skyUniforms = {
  topColour: { value: new THREE.Color(0x4d9be0) },
  midColour: { value: new THREE.Color(0x9ccdee) },
  horizonColour: { value: new THREE.Color(0xd4eef6) },
  glowColour: { value: new THREE.Color(0xffa860) },
  sunDirection: { value: new THREE.Vector3(0, 0, -1) },
  glow: { value: 0 },
};
const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(100, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyUniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColour;
      uniform vec3 midColour;
      uniform vec3 horizonColour;
      uniform vec3 glowColour;
      uniform vec3 sunDirection;
      uniform float glow;
      varying vec3 vDirection;
      void main() {
        vec3 direction = normalize(vDirection);
        // The camera sees only a thin strip of sky above the horizon, so the
        // colours change over a small range of height.
        float height = max(direction.y, 0.0);
        vec3 colour = mix(horizonColour, midColour, smoothstep(0.0, 0.09, height));
        colour = mix(colour, topColour, smoothstep(0.05, 0.42, height));
        float towardSun = max(dot(direction, normalize(sunDirection)), 0.0);
        float shine = pow(towardSun, 5.0) * 0.5 + pow(towardSun, 36.0) * 0.9;
        colour += glowColour * shine * glow * (1.0 - smoothstep(0.0, 0.45, height));
        gl_FragColor = vec4(colour, 1.0);
        #include <colorspace_fragment>
      }`,
  }),
);
skyDome.renderOrder = -1000;
skyDome.frustumCulled = false;
scene.add(skyDome);
scene.background = null;

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

// Stars over the whole sky above the horizon. They sit on a sphere further out than the
// hills and trees and move with the camera, so nothing on the ground is ever behind one.
const STAR_RADIUS = 96;
const starPositions = [];
for (let i = 0; i < 500; i++) {
  const height = 0.03 + Math.random() * 0.97;
  const angle = Math.random() * Math.PI * 2;
  const across = Math.sqrt(1 - height * height);
  starPositions.push(Math.cos(angle) * across * STAR_RADIUS, height * STAR_RADIUS, Math.sin(angle) * across * STAR_RADIUS);
}
const starGeometry = new THREE.BufferGeometry();
starGeometry.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
const stars = new THREE.Points(
  starGeometry,
  new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, transparent: true, opacity: 0, depthWrite: false, fog: false }),
);
stars.frustumCulled = false;
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

  blendColour(skyColour, from.sky, to.sky, t);
  scene.fog.color.copy(skyColour);
  skyUniforms.horizonColour.value.copy(skyColour);
  blendColour(skyUniforms.midColour.value, from.mid, to.mid, t);
  blendColour(skyUniforms.topColour.value, from.top, to.top, t);
  skyUniforms.glow.value = from.glow + (to.glow - from.glow) * t;
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
  // The dome stays centred on the camera, and its glow sits where the sun is.
  skyDome.position.copy(camera.position);
  stars.position.copy(camera.position);
  skyUniforms.sunDirection.value.copy(sunDisc.position).sub(camera.position).normalize();

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

// A low fence round a bed's base, with a gap where each walkway meets it. Each bed
// can have its own kind. They are only for show: a fence stands between the plots
// and the path and never limits what anyone can do.
const FENCE_HALF = 2.64;
const FENCE_BASE_Y = -0.15;
const FENCE_GAP_HALF = 0.85;

// Which bed has which fence, and the sides of each that a walkway leaves from.
const FENCES = { 0: "hedge", 1: "picket", 2: "log", 3: "wattle" };

// Pure white, with a little glow of its own so the shaded sides do not read grey.
const picketMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.14, flatShading: true });
const picketPostGeometry = new THREE.BoxGeometry(0.07, 0.34, 0.07);
const picketCapGeometry = new THREE.ConeGeometry(0.06, 0.07, 4);
const WATTLE_STEP = 0.24;
const wattleStakeGeometry = new THREE.CylinderGeometry(0.03, 0.035, 0.4, 6);
const wattleStakeMaterial = flatMaterial(0x6e4a2a);
// Two browns, so the weave reads as separate rods going over and under.
const wattleRodMaterials = [flatMaterial(0xa87a46), flatMaterial(0x8a6236)];

// Log rail: round log posts with a rounded top, joined by two rough rails that run
// from post to post, each a little thicker or paler than the last.
const LOG_STEP = 0.66;
const logPostGeometry = new THREE.CylinderGeometry(0.06, 0.07, 0.36, 7);
const logMaterials = [flatMaterial(0x7a5230), flatMaterial(0x6a4626), flatMaterial(0x8a6038)];

// Box hedge: a clipped low hedge, a dark green block with rounded tufts along its
// top, and at each opening an arch of roses over the path.
const hedgeMaterials = [PALETTE.hedge, PALETTE.hedgeMid, PALETTE.hedgeLight].map((colour) => flatMaterial(colour));
const hedgeBallGeometry = new THREE.SphereGeometry(0.15, 7, 5);
const roseMaterials = [PALETTE.rose, PALETTE.roseDeep].map((colour) => flatMaterial(colour));
const roseGeometry = new THREE.SphereGeometry(0.052, 6, 5);
const archLeafGeometry = new THREE.SphereGeometry(0.06, 6, 4);
const ARCH_SPRING_Y = 0.42;
const ARCH_RISE = 0.4;

// `place(mesh, side, t, y, lift)` puts a mesh at t along the side; `lift` moves it
// out from (+) or in toward (-) the side's line.
function buildFence(bed, kind, gaps) {
  const centre = BED_CENTRES[bed];
  const group = new THREE.Group();
  group.position.set(centre.x, FENCE_BASE_Y, centre.z);
  const sides = {
    back: { along: "x", across: -FENCE_HALF, out: -1 },
    front: { along: "x", across: FENCE_HALF, out: 1 },
    left: { along: "z", across: -FENCE_HALF, out: -1 },
    right: { along: "z", across: FENCE_HALF, out: 1 },
  };
  const place = (mesh, side, t, y, lift = 0) => {
    const { along, across, out } = sides[side];
    const offset = across + out * lift;
    mesh.position.set(along === "x" ? t : offset, y, along === "x" ? offset : t);
    group.add(mesh);
  };
  // A rose arch over a walkway opening: two posts and a half ring of green, with
  // roses and leaves growing over it.
  const buildArch = (side) => {
    const along = sides[side].along;
    for (const t of [-FENCE_GAP_HALF, FENCE_GAP_HALF]) {
      place(new THREE.Mesh(new THREE.BoxGeometry(0.09, ARCH_SPRING_Y, 0.09), hedgeMaterials[0]), side, t, ARCH_SPRING_Y / 2);
    }
    const arc = new THREE.Mesh(new THREE.TorusGeometry(FENCE_GAP_HALF, 0.045, 6, 18, Math.PI), hedgeMaterials[1]);
    arc.scale.y = ARCH_RISE;
    arc.rotation.y = along === "x" ? 0 : Math.PI / 2;
    place(arc, side, 0, ARCH_SPRING_Y);
    for (let k = 0; k <= 10; k++) {
      const angle = (k / 10) * Math.PI;
      const t = Math.cos(angle) * FENCE_GAP_HALF;
      const y = ARCH_SPRING_Y + Math.sin(angle) * FENCE_GAP_HALF * ARCH_RISE;
      if (k % 2 === 0) place(new THREE.Mesh(roseGeometry, roseMaterials[(k / 2) % 2]), side, t, y + 0.03, 0.03);
      else place(new THREE.Mesh(archLeafGeometry, hedgeMaterials[2]), side, t, y, -0.03);
    }
    for (const sign of [-1, 1]) {
      for (const y of [0.12, 0.26, 0.38]) place(new THREE.Mesh(roseGeometry, roseMaterials[Math.round(y * 10) % 2]), side, sign * FENCE_GAP_HALF, y, 0.05);
    }
  };
  const box = (side, length, height, thickness) => new THREE.BoxGeometry(...(sides[side].along === "x" ? [length, height, thickness] : [thickness, height, length]));

  for (const side of Object.keys(sides)) {
    const segments = gaps.has(side)
      ? [[-FENCE_HALF, -FENCE_GAP_HALF], [FENCE_GAP_HALF, FENCE_HALF]]
      : [[-FENCE_HALF, FENCE_HALF]];
    for (const [from, to] of segments) {
      if (kind === "picket") {
        for (let t = from; t <= to + 0.001; t += 0.3) {
          place(new THREE.Mesh(picketPostGeometry, picketMaterial), side, t, 0.17);
          const cap = new THREE.Mesh(picketCapGeometry, picketMaterial);
          cap.rotation.y = Math.PI / 4;
          place(cap, side, t, 0.375);
        }
        for (const y of [0.1, 0.25]) place(new THREE.Mesh(box(side, to - from, 0.035, 0.03), picketMaterial), side, (from + to) / 2, y);
      } else if (kind === "hedge") {
        const length = to - from;
        place(new THREE.Mesh(box(side, length, 0.26, 0.26), hedgeMaterials[0]), side, (from + to) / 2, 0.13);
        const count = Math.max(2, Math.round(length / 0.3));
        for (let i = 0; i < count; i++) {
          const tuft = new THREE.Mesh(hedgeBallGeometry, hedgeMaterials[1 + (i % 2)]);
          tuft.scale.set(1, 0.65, 1);
          place(tuft, side, from + (i + 0.5) * (length / count), 0.29);
        }
      } else if (kind === "log") {
        const count = Math.max(1, Math.round((to - from) / LOG_STEP));
        const step = (to - from) / count;
        for (let i = 0; i <= count; i++) {
          const post = new THREE.Mesh(logPostGeometry, logMaterials[i % 3]);
          place(post, side, from + i * step, 0.18);
          const top = new THREE.Mesh(new THREE.SphereGeometry(0.066, 7, 4), logMaterials[i % 3]);
          top.scale.y = 0.5;
          place(top, side, from + i * step, 0.37);
        }
        [[0.11, 0.045], [0.26, 0.04]].forEach(([y, thickness], row) => {
          for (let i = 0; i < count; i++) {
            const rail = new THREE.Mesh(box(side, step, thickness * 1.7, thickness * 1.7), logMaterials[(i + row) % 3]);
            place(rail, side, from + (i + 0.5) * step, y + ((i + row) % 2) * 0.012, 0.04);
          }
        });
      } else {
        // Wattle: upright stakes, with rods woven over and under them in rows,
        // each row going the other way round from the one below.
        const count = Math.max(2, Math.round((to - from) / WATTLE_STEP));
        const step = (to - from) / count;
        for (let i = 0; i <= count; i++) place(new THREE.Mesh(wattleStakeGeometry, wattleStakeMaterial), side, from + i * step, 0.2);
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < count; i++) {
            const rod = new THREE.Mesh(box(side, step * 1.05, 0.075, 0.05), wattleRodMaterials[(i + row) % 2]);
            place(rod, side, from + (i + 0.5) * step, 0.08 + row * 0.1, (i + row) % 2 === 0 ? 0.035 : -0.035);
          }
        }
      }
    }
    if (kind === "hedge" && gaps.has(side)) buildArch(side);
  }
  scene.add(group);
}

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

// Each fenced bed's fence leaves a gap on the sides a walkway leaves from.
for (const [bed, kind] of Object.entries(FENCES)) {
  const gaps = new Set();
  for (const walkway of WALKWAYS) {
    for (const [end, along] of [[walkway.a, walkway.aAlong], [walkway.b, walkway.bAlong]]) {
      if (end === Number(bed)) gaps.add(Object.keys(SIDE_MIDDLE).find((side) => SIDE_MIDDLE[side] === along));
    }
  }
  buildFence(Number(bed), kind, gaps);
}


// Earth showing in the gaps between the stones, so they read as set in the ground rather
// than laid on the grass. Each bed has a patch of bare earth with a wobbly edge, a ring of
// muddy grass round it where it melts into the lawn, and a ragged strip along each
// walkway. The outer flagstones stop at the edge of the patch, so the path follows it.
const earthMaterial = flatMaterial(0x8a7556);
const fringeMaterial = flatMaterial(0x76703f);
for (const [material, offset] of [[earthMaterial, -2], [fringeMaterial, -1]]) {
  material.polygonOffset = true;
  material.polygonOffsetFactor = offset;
  material.polygonOffsetUnits = offset;
}
const EARTH_SIZE = 5.45;
const EARTH_CORNER = 3.5; // lower is rounder
const earthSeed = (bed) => bed * 3.1 + 0.7;

// How far the edge of a bed's earth is from its middle, looking in direction theta: a
// rounded square with a few slow waves round it. Never less than about 5.1, so the
// stones along the straight parts always sit on earth.
function earthRadius(bed, theta, grow = 0) {
  const seed = earthSeed(bed);
  const c = Math.abs(Math.cos(theta));
  const sn = Math.abs(Math.sin(theta));
  const square = EARTH_SIZE / Math.pow(Math.pow(c, EARTH_CORNER) + Math.pow(sn, EARTH_CORNER), 1 / EARTH_CORNER);
  const wobble = 0.5 * Math.sin(2 * theta + seed) + 0.3 * Math.sin(3 * theta + seed * 2.1) + 0.2 * Math.sin(5 * theta + seed * 3.7);
  return square + 0.36 * wobble + grow;
}

function earthPatch(bed, grow, material) {
  const centre = BED_CENTRES[bed];
  const outline = new THREE.Shape();
  const points = 96;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * Math.PI * 2;
    const r = earthRadius(bed, theta, grow + (grow > 0 ? 0.12 * Math.sin(theta * 9 + bed) : 0));
    // Laying the shape flat sends its y to -z, so drawing at -sin puts the edge at +sin on the ground.
    if (i === 0) outline.moveTo(Math.cos(theta) * r, -Math.sin(theta) * r);
    else outline.lineTo(Math.cos(theta) * r, -Math.sin(theta) * r);
  }
  outline.closePath();
  const geometry = new THREE.ShapeGeometry(outline);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(centre.x, GROUND_Y + (grow > 0 ? 0.012 : 0.02), centre.z);
  scene.add(mesh);
}
BED_CENTRES.forEach((_, bed) => {
  earthPatch(bed, 0.34, fringeMaterial);
  earthPatch(bed, 0, earthMaterial);
});

// A ragged strip of earth down the length of a walkway, wider than the stones on it.
for (const [kind, material, extra, height] of [["fringe", fringeMaterial, 0.3, 0.012], ["earth", earthMaterial, 0, 0.02]]) {
  WALKWAYS.forEach((walkway, index) => {
    const dx = walkway.to.x - walkway.from.x;
    const dz = walkway.to.z - walkway.from.z;
    const length = Math.hypot(dx, dz);
    const nx = -dz / length;
    const nz = dx / length;
    const steps = Math.ceil(length * 2.5);
    const positions = [];
    const indices = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const half = 1.38 + extra + 0.16 * Math.sin(i * 0.9 + index * 2) + 0.1 * Math.sin(i * 2.3 + index) + (kind === "fringe" ? 0.06 * Math.sin(i * 3.1) : 0);
      const x = walkway.from.x + dx * t;
      const z = walkway.from.z + dz * t;
      positions.push(x + nx * half, GROUND_Y + height, z + nz * half, x - nx * half, GROUND_Y + height, z - nz * half);
      if (i < steps) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(positions.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
    geometry.setIndex(indices);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: material.color, flatShading: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: material.polygonOffsetFactor, polygonOffsetUnits: material.polygonOffsetUnits }));
    scene.add(mesh);
  });
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
  for (const [bed, centre] of BED_CENTRES.entries()) {
    const edge = Math.max(Math.abs(x - centre.x), Math.abs(z - centre.z));
    if (edge < PATH_INNER || edge > PATH_OUTER) continue;
    // Stop at the edge of the bed's earth, so the outer stones follow its wobbly outline.
    const reach = earthRadius(bed, Math.atan2(z - centre.z, x - centre.x));
    if (Math.hypot(x - centre.x, z - centre.z) <= reach - 0.45) return true;
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

// Your own garden: a bed of 4 x 4 plots out in the grass on the far side of the
// shared garden from the cottage, only ever filled in from your own events. Every
// browser draws an empty one there, and only yours is ever told what grows in it, so
// nobody else sees your plants. No figure walks round it.
const OWN_COLS = 4;
const OWN_GARDEN_SIZE = OWN_COLS * OWN_COLS;
const OWN_CENTRE = { x: -16, z: 6 };
// From the middle of the bed to the middle of its edge row, and to its hedge.
const OWN_HALF = ((OWN_COLS - 1) / 2) * SPACING;
const OWN_HEDGE = OWN_HALF + 0.98;
// position -> { group, soilMesh, plantGroup, ring, baseSoilColor }, like the shared plots
const ownObjects = new Map();
// position -> your latest own Plot from the server
const ownPlots = new Map();
// The hedge round your bed, as its own group so a fence you have put out can stand in
// its place.
const ownHedge = new THREE.Group();
scene.add(ownHedge);

{
  const base = new THREE.Mesh(new THREE.BoxGeometry(OWN_HALF * 2 + 1.7, 0.3, OWN_HALF * 2 + 1.7), flatMaterial(bedBaseColour));
  base.position.set(OWN_CENTRE.x, -0.3, OWN_CENTRE.z);
  scene.add(base);

  // A ring of flat stones round it, and a low hedge with a gap at the front.
  const stoneMaterial = flatMaterial(0x9a958c);
  const stoneGeometry = new THREE.CylinderGeometry(0.32, 0.36, 0.08, 7);
  for (let i = 0; i < 34; i++) {
    const t = (i / 34) * Math.PI * 2;
    // No stones in front of the gap in the hedge, where the path comes in.
    if (Math.sin(t) > 0 && Math.abs(Math.cos(t)) < 0.27) continue;
    const r = OWN_HEDGE + 0.85 + seeded(i * 3 + 70) * 0.15;
    const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
    stone.position.set(OWN_CENTRE.x + Math.cos(t) * r * 1.05, GROUND_Y + 0.04, OWN_CENTRE.z + Math.sin(t) * r * 1.05);
    stone.rotation.y = seeded(i + 80) * Math.PI;
    stone.scale.setScalar(0.8 + seeded(i + 90) * 0.4);
    scene.add(stone);
  }
  for (let side = 0; side < 4; side++) {
    const steps = Math.round(OWN_HEDGE / 0.27);
    for (let k = -steps; k <= steps; k++) {
      // The front, facing the shared garden, has a gap to step through.
      if (side === 0 && Math.abs(k) < 2) continue;
      const along = k * 0.27;
      const out = OWN_HEDGE;
      const [x, z] = [[along, out], [out, along], [along, -out], [-out, along]][side];
      const ball = new THREE.Mesh(hedgeBallGeometry, hedgeMaterials[(k + side) % 3 < 0 ? 0 : (k + side) % 3]);
      ball.position.set(OWN_CENTRE.x + x, -0.08, OWN_CENTRE.z + z);
      ownHedge.add(ball);
    }
  }

  for (let position = 0; position < OWN_GARDEN_SIZE; position++) {
    const group = new THREE.Group();
    group.position.set(
      OWN_CENTRE.x - OWN_HALF + (position % OWN_COLS) * SPACING,
      0,
      OWN_CENTRE.z - OWN_HALF + Math.floor(position / OWN_COLS) * SPACING,
    );
    const soilMesh = new THREE.Mesh(new THREE.BoxGeometry(TILE_SIZE, TILE_HEIGHT, TILE_SIZE), flatMaterial(soilColorFor("empty")));
    soilMesh.position.y = -TILE_HEIGHT / 2;
    soilMesh.userData.ownPosition = position;
    group.add(soilMesh);
    const plantGroup = buildPlant("tree", "empty");
    group.add(plantGroup);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.48, 0.57, 4, 1, Math.PI / 4),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    ring.visible = false;
    group.add(ring);
    scene.add(group);
    ownObjects.set(position, { group, soilMesh, plantGroup, ring, baseSoilColor: new THREE.Color(soilColorFor("empty")) });
  }
}

const ownSoilMeshes = [...ownObjects.values()].map((obj) => obj.soilMesh);

function rebuildOwnPlant(position, type, state) {
  const obj = ownObjects.get(position);
  disposeGroup(obj.plantGroup);
  obj.group.remove(obj.plantGroup);
  obj.plantGroup = buildPlant(type, state);
  obj.group.add(obj.plantGroup);
  obj.baseSoilColor = new THREE.Color(soilColorFor(state));
  obj.soilMesh.material.color.copy(obj.baseSoilColor);
}

// Decorations you have put out in your own garden: a fence round the bed in place of
// the hedge, and props on four fixed spots beyond the stones. They are only for show:
// nothing in either garden depends on them, and only you ever see them.
// None is on the side nearest the default camera, where it would be cut off at the bottom.
const OWN_PROP_SPOTS = [[-3.3, 3], [-0.5, -4.2], [-3, -3], [3, -3], [-4.5, -0.2]];
const OWN_SPOT_NAMES = ["fence", ...OWN_PROP_SPOTS.map((_, i) => `prop-${i}`)];
const stoneWallMaterials = [0x9a958c, 0x8a867e, 0xa8a399].map((colour) => flatMaterial(colour));
const ownDecorBuilt = new Map(); // spot -> { id, group }

function buildOwnFence(kind) {
  if (!["picket", "rustic", "stone"].includes(kind)) return null;
  const group = new THREE.Group();
  group.position.set(OWN_CENTRE.x, FENCE_BASE_Y, OWN_CENTRE.z);
  const half = OWN_HEDGE;
  const gap = 0.55;
  [{ along: "x", across: half }, { along: "x", across: -half }, { along: "z", across: -half }, { along: "z", across: half }].forEach((side, index) => {
    // The front, facing the shared garden, has a gap to step through.
    const segments = index === 0 ? [[-half, -gap], [gap, half]] : [[-half, half]];
    for (const [from, to] of segments) {
      const length = to - from;
      const put = (mesh, t, y, lift = 0) => {
        mesh.position.set(side.along === "x" ? t : side.across + lift, y, side.along === "x" ? side.across + lift : t);
        group.add(mesh);
      };
      const box = (l, h, d) => new THREE.BoxGeometry(...(side.along === "x" ? [l, h, d] : [d, h, l]));
      if (kind === "picket") {
        for (let t = from; t <= to + 0.001; t += 0.3) {
          put(new THREE.Mesh(picketPostGeometry, picketMaterial), t, 0.17);
          const cap = new THREE.Mesh(picketCapGeometry, picketMaterial);
          cap.rotation.y = Math.PI / 4;
          put(cap, t, 0.375);
        }
        for (const y of [0.1, 0.25]) put(new THREE.Mesh(box(length, 0.035, 0.03), picketMaterial), (from + to) / 2, y);
      } else if (kind === "rustic") {
        const count = Math.max(1, Math.round(length / LOG_STEP));
        const step = length / count;
        for (let i = 0; i <= count; i++) put(new THREE.Mesh(logPostGeometry, logMaterials[i % 3]), from + i * step, 0.18);
        [[0.11, 0.045], [0.26, 0.04]].forEach(([y, thickness], row) => {
          for (let i = 0; i < count; i++) put(new THREE.Mesh(box(step, thickness * 1.7, thickness * 1.7), logMaterials[(i + row) % 3]), from + (i + 0.5) * step, y, 0.04);
        });
      } else {
        const count = Math.max(2, Math.round(length / 0.45));
        const step = length / count;
        for (let i = 0; i < count; i++) {
          const height = 0.22 + (i % 3) * 0.035;
          put(new THREE.Mesh(box(step * 0.96, height, 0.2), stoneWallMaterials[i % 3]), from + (i + 0.5) * step, height / 2);
        }
      }
    }
  });
  return group;
}

let glowMap = null;
function glowTexture() {
  if (glowMap) return glowMap;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.25, "rgba(255,255,255,0.45)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  glowMap = new THREE.CanvasTexture(canvas);
  return glowMap;
}

// Each prop is drawn from a few plain shapes and stands facing the bed.
function buildOwnProp(kind, spotIndex) {
  const group = new THREE.Group();
  const add = (geometry, colour, x, y, z, rotation) => {
    const mesh = new THREE.Mesh(geometry, flatMaterial(colour));
    mesh.position.set(x, y, z);
    if (rotation) mesh.rotation.set(...rotation);
    group.add(mesh);
    return mesh;
  };
  if (kind === "bench") {
    // A garden bench: a seat and a back of separate slats, back legs that rise to hold the
    // back, arms, a brace between the legs and a cushion. About a metre and a half wide.
    const woods = [0xb07a45, 0xa66f3c];
    const dark = 0x6a4626;
    for (let i = 0; i < 5; i++) add(new THREE.BoxGeometry(1.5, 0.045, 0.085), woods[i % 2], 0, 0.43, -0.19 + i * 0.095);
    for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(1.5, 0.11, 0.04), woods[i % 2], 0, 0.64 + i * 0.14, -0.25 - i * 0.02, [-0.12, 0, 0]);
    for (const x of [-0.68, 0.68]) {
      add(new THREE.BoxGeometry(0.075, 0.43, 0.075), dark, x, 0.215, 0.2);
      add(new THREE.BoxGeometry(0.075, 0.98, 0.075), dark, x, 0.49, -0.23, [-0.12, 0, 0]);
      add(new THREE.BoxGeometry(0.07, 0.035, 0.5), woods[0], x * 1.06, 0.66, -0.02);
      add(new THREE.BoxGeometry(0.05, 0.23, 0.05), dark, x * 1.06, 0.55, 0.19);
    }
    add(new THREE.BoxGeometry(1.38, 0.04, 0.04), dark, 0, 0.17, 0.2);
    add(new THREE.BoxGeometry(1.38, 0.04, 0.04), dark, 0, 0.17, -0.2);
    // A cushion on one side, a little crooked, so it looks sat on.
    add(new THREE.BoxGeometry(0.44, 0.085, 0.34), 0xd9776b, 0.36, 0.5, 0.02, [0, 0.12, 0]);
    add(new THREE.BoxGeometry(0.4, 0.2, 0.07), 0xe8998d, 0.36, 0.64, -0.2, [-0.22, 0.1, 0]);
  } else if (kind === "lantern") {
    // A Victorian lamp post: a stepped plinth, a fluted column that narrows as it rises, brass
    // collars, a ladder bar and curled brackets, and a tapering glass lantern in an iron frame
    // with a pointed cap and a finial. Dark green iron and brass; it glows after dark.
    const iron = 0x1f3a32;
    const brass = 0xb38b3d;
    add(new THREE.CylinderGeometry(0.3, 0.34, 0.1, 8), 0x8d8a82, 0, 0.05, 0);
    add(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 8), iron, 0, 0.16, 0);
    add(new THREE.CylinderGeometry(0.14, 0.2, 0.2, 8), iron, 0, 0.32, 0);
    add(new THREE.TorusGeometry(0.115, 0.025, 6, 12), brass, 0, 0.44, 0, [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.045, 0.085, 1.0, 8), iron, 0, 0.96, 0);
    add(new THREE.TorusGeometry(0.085, 0.02, 6, 12), brass, 0, 0.7, 0, [Math.PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(0.062, 0.02, 6, 12), brass, 0, 1.18, 0, [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.075, 0.05, 0.1, 8), iron, 0, 1.5, 0);
    // The ladder bar, with a knob at each end, and a pair of scrolled brackets.
    add(new THREE.BoxGeometry(0.46, 0.022, 0.022), iron, 0, 1.3, 0);
    for (const side of [-1, 1]) {
      add(new THREE.SphereGeometry(0.032, 6, 5), brass, side * 0.23, 1.3, 0);
      add(new THREE.TorusGeometry(0.1, 0.014, 5, 10, Math.PI), iron, side * 0.1, 1.46, 0, [0, 0, Math.PI]);
    }
    // The lantern: a cup, glass that widens upward, four corner posts, and a roof.
    add(new THREE.ConeGeometry(0.1, 0.14, 4), iron, 0, 1.6, 0, [Math.PI, Math.PI / 4, 0]);
    const glass = add(new THREE.CylinderGeometry(0.17, 0.1, 0.36, 4), 0xffe3a0, 0, 1.85, 0, [0, Math.PI / 4, 0]);
    glass.material.emissive = new THREE.Color(0xffb84a);
    glass.material.emissiveIntensity = 0.9;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(new THREE.BoxGeometry(0.02, 0.38, 0.02), iron, dx * 0.1, 1.85, dz * 0.1);
    }
    add(new THREE.BoxGeometry(0.34, 0.025, 0.34), iron, 0, 2.04, 0);
    add(new THREE.ConeGeometry(0.27, 0.18, 4), iron, 0, 2.145, 0, [0, Math.PI / 4, 0]);
    add(new THREE.ConeGeometry(0.1, 0.1, 4), iron, 0, 2.28, 0, [0, Math.PI / 4, 0]);
    add(new THREE.SphereGeometry(0.04, 7, 5), brass, 0, 2.35, 0);
    add(new THREE.ConeGeometry(0.014, 0.12, 5), brass, 0, 2.44, 0);
    // A soft glow: a sprite painted with a radial fade, so it has no edge.
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(2.1);
    halo.position.set(0, 1.85, 0);
    group.add(halo);
    // Only lit after dark: updateFireflies sets its glow from the night.
    group.userData.halo = halo;
  } else if (kind === "scarecrow") {
    // A scarecrow on a pole: a patched shirt, straw at the cuffs and hem, a sack head with a
    // stitched face, and a battered hat with a band.
    const wood = 0x7a5230;
    add(new THREE.CylinderGeometry(0.04, 0.05, 1.9, 6), wood, 0, 0.95, 0);
    add(new THREE.BoxGeometry(1.35, 0.07, 0.07), wood, 0, 1.28, 0, [0, 0, 0.05]);
    add(new THREE.BoxGeometry(0.5, 0.58, 0.28), 0x4a6aa8, 0, 1.13, 0);
    add(new THREE.BoxGeometry(1.0, 0.2, 0.2), 0x4a6aa8, 0, 1.28, 0);
    add(new THREE.BoxGeometry(0.16, 0.16, 0.02), 0xc9553f, 0.12, 1.1, 0.15);
    add(new THREE.BoxGeometry(0.5, 0.07, 0.3), 0x364f82, 0, 0.84, 0);
    const straw = [0xe3c35e, 0xd1ae44, 0xedd277];
    for (const [x, y, rz] of [[-0.7, 1.26, 1.5], [0.7, 1.26, -1.5], [-0.66, 1.2, 1.9], [0.66, 1.2, -1.9], [-0.7, 1.3, 1.1], [0.7, 1.3, -1.1]]) {
      add(new THREE.ConeGeometry(0.035, 0.2, 5), straw[Math.abs(Math.round(x * 10 + y * 10)) % 3], x, y, 0, [0, 0, rz]);
    }
    for (let i = 0; i < 7; i++) add(new THREE.ConeGeometry(0.03, 0.2, 5), straw[i % 3], -0.2 + i * 0.065, 0.74, 0.02 * (i % 3 - 1), [Math.PI, 0, (i - 3) * 0.12]);
    add(new THREE.SphereGeometry(0.2, 10, 8), 0xdcc48a, 0, 1.6, 0);
    for (const x of [-0.07, 0.07]) add(new THREE.SphereGeometry(0.025, 6, 5), 0x2b2118, x, 1.64, 0.18);
    add(new THREE.BoxGeometry(0.14, 0.02, 0.02), 0x2b2118, 0, 1.54, 0.19);
    for (const x of [-0.06, -0.02, 0.02, 0.06]) add(new THREE.BoxGeometry(0.012, 0.045, 0.012), 0x2b2118, x, 1.54, 0.19);
    add(new THREE.CylinderGeometry(0.34, 0.36, 0.035, 12), 0x8a6a3a, 0, 1.76, 0, [0.08, 0, 0.05]);
    add(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 10), 0x8a6a3a, 0, 1.87, 0, [0.08, 0, 0.05]);
    add(new THREE.CylinderGeometry(0.205, 0.205, 0.045, 10), 0x4f6b35, 0, 1.79, 0, [0.08, 0, 0.05]);
  } else if (kind === "gnome") {
    // A garden gnome about as tall as a bench: boots, a blue tunic with a belt and buckle,
    // arms, a big white beard, a round nose and a tall red hat that flops over.
    add(new THREE.BoxGeometry(0.14, 0.1, 0.22), 0x4a3320, -0.1, 0.05, 0.03);
    add(new THREE.BoxGeometry(0.14, 0.1, 0.22), 0x4a3320, 0.1, 0.05, 0.03);
    add(new THREE.CylinderGeometry(0.19, 0.27, 0.5, 10), 0x3b6ab8, 0, 0.34, 0);
    add(new THREE.CylinderGeometry(0.27, 0.27, 0.06, 10), 0x2b2b30, 0, 0.3, 0);
    add(new THREE.BoxGeometry(0.1, 0.08, 0.02), 0xe7c04a, 0, 0.3, 0.27);
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.055, 0.065, 0.3, 7), 0x3b6ab8, side * 0.24, 0.42, 0.05, [0.2, 0, side * -0.4]);
      add(new THREE.SphereGeometry(0.06, 7, 5), 0xf0c8a0, side * 0.32, 0.29, 0.11);
    }
    add(new THREE.SphereGeometry(0.17, 10, 8), 0xf0c8a0, 0, 0.71, 0);
    add(new THREE.ConeGeometry(0.25, 0.42, 10), 0xfafafa, 0, 0.5, 0.1, [Math.PI + 0.25, 0, 0]);
    add(new THREE.SphereGeometry(0.06, 8, 6), 0xe89a8a, 0, 0.71, 0.18);
    for (const x of [-0.06, 0.06]) add(new THREE.SphereGeometry(0.02, 6, 5), 0x2b2118, x, 0.77, 0.15);
    add(new THREE.ConeGeometry(0.2, 0.55, 10), 0xd0382c, 0, 1.1, 0, [0, 0, 0.05]);
    add(new THREE.ConeGeometry(0.1, 0.22, 8), 0xd0382c, 0.07, 1.42, 0, [0, 0, -0.9]);
    add(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 10), 0xb02c22, 0, 0.84, 0);
  } else if (kind === "birdbath") {
    // A stone birdbath: a stepped base, a stem with a ring, a wide basin with a rim and
    // water, and a little bird perched on the edge.
    const stone = 0xb0aca2;
    add(new THREE.CylinderGeometry(0.32, 0.36, 0.1, 12), 0x9a958c, 0, 0.05, 0);
    add(new THREE.CylinderGeometry(0.22, 0.28, 0.1, 12), stone, 0, 0.15, 0);
    add(new THREE.CylinderGeometry(0.1, 0.14, 0.55, 10), stone, 0, 0.45, 0);
    add(new THREE.TorusGeometry(0.13, 0.04, 6, 12), stone, 0, 0.5, 0, [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.5, 0.22, 0.16, 14), stone, 0, 0.82, 0);
    add(new THREE.TorusGeometry(0.5, 0.045, 6, 18), 0xc4c0b6, 0, 0.9, 0, [Math.PI / 2, 0, 0]);
    add(new THREE.CylinderGeometry(0.46, 0.46, 0.02, 16), 0x6fb7ff, 0, 0.88, 0).material.opacity = 0.9;
    // The bird: a round body, a head, a beak, a tail and wings.
    const bird = new THREE.Group();
    const part = (geometry, colour, x, y, z, rotation) => {
      const mesh = new THREE.Mesh(geometry, flatMaterial(colour));
      mesh.position.set(x, y, z);
      if (rotation) mesh.rotation.set(...rotation);
      bird.add(mesh);
    };
    part(new THREE.SphereGeometry(0.075, 8, 6), 0xd9604a, 0, 0.04, 0);
    part(new THREE.SphereGeometry(0.05, 8, 6), 0xc9503c, 0.06, 0.1, 0);
    part(new THREE.ConeGeometry(0.018, 0.05, 5), 0xf0b030, 0.12, 0.1, 0, [0, 0, -Math.PI / 2]);
    part(new THREE.ConeGeometry(0.03, 0.1, 5), 0xa63e2e, -0.1, 0.03, 0, [0, 0, Math.PI / 2 + 0.3]);
    part(new THREE.BoxGeometry(0.1, 0.02, 0.05), 0xb04834, -0.01, 0.05, 0.06, [0.2, 0, 0.1]);
    bird.position.set(0.36, 0.93, 0.18);
    bird.rotation.y = 0.5;
    group.add(bird);
  } else {
    return null;
  }
  const [x, z] = OWN_PROP_SPOTS[spotIndex];
  group.position.set(OWN_CENTRE.x + x, GROUND_Y, OWN_CENTRE.z + z);
  group.rotation.y = Math.atan2(-x, -z);
  return group;
}

// Makes the scene match what you have put out. Anything gone from a spot is taken away.
function syncOwnDecor() {
  for (const spot of OWN_SPOT_NAMES) {
    const id = ownDecor.placed[spot] ?? null;
    const built = ownDecorBuilt.get(spot);
    if ((built?.id ?? null) === id) continue;
    if (built) {
      scene.remove(built.group);
      disposeGroup(built.group);
      ownDecorBuilt.delete(spot);
    }
    if (!id) continue;
    const group = spot === "fence" ? buildOwnFence(id) : buildOwnProp(id, Number(spot.slice(5)));
    if (!group) continue;
    scene.add(group);
    ownDecorBuilt.set(spot, { id, group });
  }
  ownHedge.visible = !ownDecorBuilt.has("fence");
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

  // Your own plots' rings are only ever yours: they show how recently you watered.
  for (const [position, obj] of ownObjects) {
    const plot = ownPlots.get(position);
    if (!plot || plot.state === "empty" || plot.state === "wilted") {
      obj.ring.visible = false;
      continue;
    }
    const freshness = freshnessOf(plot);
    ringColour.copy(RING_GREY).lerp(me ? colourFor(me) : RING_GREY, freshness);
    let opacity = 0.35 + 0.65 * freshness;
    if (freshness < THIRSTY_FRACTION) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 250);
      ringColour.lerp(RING_AMBER, 0.75);
      opacity = 0.45 + 0.55 * pulse;
    }
    obj.ring.visible = true;
    obj.ring.material.color.copy(ringColour);
    obj.ring.material.opacity = opacity;
  }
}

// Insects: butterflies visit a flower in bloom and bees a shrub in flower or a sunflower, by
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
      kind = plot.plantType === "flower" ? "butterfly" : (plot.plantType === "shrub" || plot.plantType === "sunflower" || plot.plantType === "lavender" || plot.plantType === "foxglove") ? "bee" : null;
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
    return `Empty plot — click to plant a ${PLANT_NAME[plantHere(bedOfPosition(plot.position))].toLowerCase()}`;
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
// What each bed is called and takes comes from the server in the opening `hello`:
// the server decides, and the page only follows. Until it has spoken, beds are
// numbered and take anything.
let beds = Array.from({ length: BEDS }, (_, i) => ({ name: `Bed ${i + 1}`, takes: null }));
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
  if (ownMode) closeOwnGarden();
  if (bed === currentBed) return;
  currentBed = bed;
  setHoveredBed(null);
  renderBedHere();

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
    button.setAttribute("aria-checked", String(button.dataset.type === plantHere()));
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

// What a click on an empty plot plants in the bed you are at: your own choice if
// the bed takes it, otherwise the first thing it does take.
function plantHere(bed = currentBed) {
  const takes = beds[bed].takes;
  if (takes === null || takes.includes(selectedType)) return selectedType;
  return takes[0];
}

// Show where you are and only the plants this bed takes, with your own choice kept
// for when you are back in a bed that takes it.
const bedHere = document.getElementById("bed-here");
function renderBedHere() {
  const { name, takes } = beds[currentBed];
  bedHere.replaceChildren(document.createTextNode(`You are in ${name}`));
  for (const button of pickerButtons) {
    button.hidden = takes !== null && !takes.includes(button.dataset.type);
    button.setAttribute("aria-checked", String(button.dataset.type === plantHere()));
  }
  if (hoveredPosition !== null) refreshStatusBarForHover(plots.get(hoveredPosition));
}
renderBedHere();

picker.addEventListener("click", (event) => {
  const button = event.target.closest("[data-type]");
  if (button) setSelectedType(button.dataset.type, true);
});
setSelectedType(selectedType, false);

function applyPlot(plot) {
  if (plot.position === choicePosition && plot.state !== "mature") closePlotChoice();
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

// One of your own plots changed, or arrived on connect.
function applyOwnPlot(plot) {
  const prev = ownPlots.get(plot.position);
  ownPlots.set(plot.position, plot);
  if (!prev || prev.state !== plot.state || prev.plantType !== plot.plantType) {
    rebuildOwnPlant(plot.position, plot.plantType ?? "tree", plot.state);
  }
  if (prev && plot.lastWateredAt !== null && (prev.lastWateredAt === null || plot.lastWateredAt > prev.lastWateredAt)) {
    const obj = ownObjects.get(plot.position);
    obj.soilMesh.material.color.copy(obj.baseSoilColor).multiplyScalar(0.55);
    setTimeout(() => obj.soilMesh.material.color.copy(obj.baseSoilColor), 700);
  }
  if (ownMode && hoveredOwn === plot.position) refreshOwnHover(plot);
}

// Visiting your own garden. The camera glides over to it and the shared garden's
// signs, picker and recent list step aside; your figure stays on the shared paths.
// Only the view changes, so it never limits what anyone can do.
let ownMode = false;
let hoveredOwn = null;
let ownReturn = null; // where the camera was, to glide back to
let ownSeeds = {};
let ownSelected = null;
const ownBar = document.getElementById("own-bar");
const ownSeedLine = document.getElementById("own-seed");
const ownPicker = document.getElementById("own-picker");
const ownButtons = [document.getElementById("own-button"), document.getElementById("quick-own")];

// The button that takes you to your garden takes you back to the shared one while you
// are there, and says so.
const OWN_LABELS = {
  to: "Visit your own garden, which only you can see",
  back: "Go back to the shared garden",
};
function renderOwnButtons() {
  for (const button of ownButtons) {
    button.setAttribute("aria-label", ownMode ? OWN_LABELS.back : OWN_LABELS.to);
    const label = button.querySelector("span");
    if (label) label.textContent = ownMode ? "Shared garden" : "My garden";
  }
}

function glideTo(toTarget, toCamera) {
  glide = { start: performance.now(), fromTarget: controls.target.clone(), toTarget, fromCamera: camera.position.clone(), toCamera };
}

function openOwnGarden() {
  if (ownMode || photoMode) return;
  ownMode = true;
  closePlotChoice();
  clearHoveredPlot();
  setHoveredBed(null);
  clearStatusBarHover();
  ownReturn = { target: (glide ? glide.toTarget : controls.target).clone(), camera: (glide ? glide.toCamera : camera.position).clone() };
  document.body.classList.add("own-mode");
  ownBar.hidden = false;
  renderOwnButtons();
  refreshSeeds();
  const target = new THREE.Vector3(OWN_CENTRE.x, controls.target.y, OWN_CENTRE.z);
  // Look in from the front, the side facing the shared garden.
  glideTo(target, target.clone().add(new THREE.Vector3(4.6, 2.7, 7.9)));
  statusBar.textContent = "Your own garden. Only you can see it. Click a plot to tend it.";
}

function closeOwnGarden() {
  if (!ownMode) return;
  ownMode = false;
  clearOwnHover();
  document.body.classList.remove("own-mode");
  ownBar.hidden = true;
  renderOwnButtons();
  refreshSeeds();
  if (ownReturn) glideTo(ownReturn.target, ownReturn.camera);
  clearStatusBarHover();
}

for (const button of ownButtons) {
  button.addEventListener("click", () => (ownMode ? closeOwnGarden() : openOwnGarden()));
}
document.getElementById("own-back").addEventListener("click", closeOwnGarden);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && ownMode && plotChoice.hidden && bag.hidden && !photoMode) closeOwnGarden();
});


function describeOwnPlot(plot) {
  if (plot.state === "empty") {
    return ownSelected ? `Empty plot — click to plant a ${PLANT_NAME[ownSelected].toLowerCase()} seed` : "Empty plot — gather seeds from a fully grown plant to plant here";
  }
  const type = plot.plantType ?? "tree";
  if (plot.state === "wilted") return `${PLANT_NAME[type]}, wilted — needs composting`;
  return `${PLANT_NAME[type]}, ${STAGE_LABEL[type][plot.state]}`;
}

function refreshOwnHover(plot) {
  if (!plot) return;
  statusBar.textContent = describeOwnPlot(plot);
  if (plot.lastWateredAt !== null) statusBar.append(` — you watered it ${formatAgo(plot.lastWateredAt, serverNow())}`);
  if (isThirsty(plot)) statusBar.append(" (thirsty)");
}

function clearOwnHover() {
  if (hoveredOwn !== null) ownObjects.get(hoveredOwn).soilMesh.scale.set(1, 1, 1);
  hoveredOwn = null;
}

function ownPointerMove(event) {
  raycaster.setFromCamera(ndcFromEvent(event), camera);
  const hit = raycaster.intersectObjects(ownSoilMeshes, false)[0];
  const position = hit ? hit.object.userData.ownPosition : null;
  if (position === hoveredOwn) return;
  clearOwnHover();
  hoveredOwn = position;
  renderer.domElement.style.cursor = position === null ? "" : "pointer";
  if (position !== null) {
    ownObjects.get(position).soilMesh.scale.set(1, 1.25, 1);
    refreshOwnHover(ownPlots.get(position));
  } else {
    statusBar.textContent = "Your own garden. Only you can see it. Click a plot to tend it.";
  }
}

async function ownClick(event) {
  raycaster.setFromCamera(ndcFromEvent(event), camera);
  const hit = raycaster.intersectObjects(ownSoilMeshes, false)[0];
  if (!hit) return;
  const position = hit.object.userData.ownPosition;
  const state = ownPlots.get(position)?.state ?? "empty";
  const action = actionFor(state);
  if (action === "plant" && !ownSelected) {
    showStatusMessage("You have no seeds yet. Gather some from a fully grown plant in the shared garden.");
    return;
  }
  if (Date.now() < actionsPausedUntil) {
    showStatusMessage(SLOW_DOWN_MESSAGE);
    return;
  }
  try {
    const res = await fetch(`/api/own-garden/${position}/${action}`, {
      method: "POST",
      ...(action === "plant" ? { headers: { "content-type": "application/json" }, body: JSON.stringify({ type: ownSelected }) } : {}),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const seconds = Number(res.headers.get("retry-after"));
        actionsPausedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 5) * 1000;
      }
      showStatusMessage(body.error ?? "That action isn't valid for this plot right now.");
    }
  } catch {
    showStatusMessage("Couldn't reach the server — try again.");
  }
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

// The seeds you have gathered, for your own garden: what you have of each kind, as a
// plain line. Like the record, only ever sent to you, and it shows no total.

function renderSeeds(seeds) {
  ownSeeds = seeds;
  refreshSeeds();
}

// Your bag: the seeds you have gathered, as seed packets. It lists what you hold and
// how many of each, and nothing else: no total, no kinds you have not found, nothing
// marked new. Opened from the Bag button, and in your own garden it is where you choose
// which seed to plant.
const bag = document.getElementById("bag");
const bagList = document.getElementById("bag-list");
const bagEmpty = document.getElementById("bag-empty");
const bagButtons = [document.getElementById("bag-button"), document.getElementById("quick-bag")];
let bagOpener = null;

// A seed drawn from the sprite in the page: the shape and colour of that plant's real seed.
function seedPicture(type, className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", className);
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#seed-${type}`);
  svg.append(use);
  return svg;
}

function seedKinds() {
  return Object.entries(ownSeeds).filter(([, count]) => count > 0);
}

function refreshSeeds() {
  const kinds = seedKinds();
  if (!kinds.some(([type]) => type === ownSelected)) ownSelected = kinds[0]?.[0] ?? null;
  bagEmpty.hidden = kinds.length > 0;
  bagList.hidden = kinds.length === 0;
  bagList.replaceChildren(
    ...kinds.map(([type, count]) => {
      // In your own garden a packet is a choice of what to plant; elsewhere it is just
      // something you are holding.
      const packet = document.createElement(ownMode ? "button" : "div");
      packet.className = "packet";
      packet.dataset.type = type;
      if (ownMode) {
        packet.type = "button";
        packet.setAttribute("role", "radio");
        packet.setAttribute("aria-checked", String(type === ownSelected));
      } else {
        packet.setAttribute("role", "listitem");
      }
      packet.setAttribute("aria-label", `${PLANT_NAME[type]} seeds, ${count}`);
      const picture = seedPicture(type, "packet-picture");
      const name = document.createElement("span");
      name.className = "packet-name";
      name.textContent = PLANT_NAME[type];
      const amount = document.createElement("span");
      amount.className = "packet-count";
      amount.textContent = `× ${count}`;
      packet.append(picture, name, amount);
      return packet;
    }),
  );
  bagList.setAttribute("role", ownMode ? "radiogroup" : "list");
  // The same choice under the title, like "What to plant" in the shared garden: only
  // the seeds you hold, and picking one here or in the bag picks it in both.
  ownSeedLine.hidden = kinds.length > 0;
  ownSeedLine.textContent = "You have no seeds yet. Gather some from a fully grown plant in the shared garden.";
  ownPicker.hidden = kinds.length === 0;
  ownPicker.replaceChildren(
    ...kinds.map(([type, count]) => {
      const option = document.createElement("button");
      option.type = "button";
      option.dataset.type = type;
      option.setAttribute("role", "radio");
      option.setAttribute("aria-checked", String(type === ownSelected));
      option.setAttribute("aria-label", `${PLANT_NAME[type]} seeds, ${count}`);
      const name = document.createElement("span");
      name.textContent = PLANT_NAME[type];
      const amount = document.createElement("span");
      amount.className = "own-option-count";
      amount.textContent = `× ${count}`;
      option.append(seedPicture(type, "own-option-seed"), name, amount);
      return option;
    }),
  );
  if (hoveredOwn !== null) refreshOwnHover(ownPlots.get(hoveredOwn));
}

bagList.addEventListener("click", (event) => {
  const packet = event.target.closest("button[data-type]");
  if (!packet) return;
  ownSelected = packet.dataset.type;
  refreshSeeds();
  bagList.querySelector(`[data-type="${ownSelected}"]`)?.focus({ preventScroll: true });
});

// Decorations: what you have unlocked, how many waterings until the next, and what you
// have put where. The journal says only how many more waterings, and lists what you
// have: no total, no list of what is still locked, nothing marked new.
const ownDecor = { unlocked: [], nextIn: null, placed: {} };
let decorationList = [];
const decorBox = document.getElementById("own-decor");
const decorPicker = document.getElementById("decor-picker");
const decorNext = document.getElementById("decor-next");

function refreshDecorJournal() {
  const n = ownDecor.nextIn;
  decorNext.hidden = n === null;
  decorNext.textContent = n === null ? "" : `${n} more watering${n === 1 ? "" : "s"} in the shared garden until your next decoration`;

  const unlocked = ownDecor.unlocked.map((id) => decorationList.find((d) => d.id === id)).filter(Boolean);
  // The fences come first, in a row of their own, then the props, each in the order they
  // were unlocked. The hedge your bed starts with is not something you unlock: it is what
  // shows when no fence is out. Once you have a fence it is offered too, at the front, so
  // you can go back to it.
  const fences = unlocked.filter((d) => d.kind === "fence");
  const props = unlocked.filter((d) => d.kind !== "fence");
  const have = [...(fences.length > 0 ? [{ id: "hedge", name: "Shrub hedge", kind: "fence" }] : []), ...fences, ...props];
  decorBox.hidden = have.length === 0;
  decorPicker.replaceChildren(
    ...have.map((decoration) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.id = decoration.id;
      button.textContent = decoration.name;
      button.setAttribute(
        "aria-pressed",
        String(decoration.id === "hedge" ? !ownDecor.placed.fence : Object.values(ownDecor.placed).includes(decoration.id)),
      );
      return button;
    }),
  );
}

function renderDecorations(state) {
  ownDecor.unlocked = state.unlocked;
  ownDecor.nextIn = state.nextIn;
  ownDecor.placed = state.placed;
  syncOwnDecor();
  refreshDecorJournal();
}

// Click a decoration to put it out (a fence takes the fence spot, a prop the first free
// one), and click it again to take it away. The garden changes when the server says so.
decorPicker.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  const id = button.dataset.id;
  // The hedge takes the fence away. It does nothing if no fence is out.
  const info = id === "hedge" ? { id, kind: "fence" } : decorationList.find((d) => d.id === id);
  if (!info) return;
  if (id === "hedge" && !ownDecor.placed.fence) return;
  const spotNow = id === "hedge" ? "fence" : Object.entries(ownDecor.placed).find(([, placed]) => placed === id)?.[0];
  let spot = spotNow;
  let decoration = null;
  if (!spotNow) {
    decoration = id;
    spot = info.kind === "fence" ? "fence" : OWN_SPOT_NAMES.slice(1).find((s) => !ownDecor.placed[s]);
    if (!spot) {
      showStatusMessage("Every spot is taken. Take one away to put this out.");
      return;
    }
  }
  if (Date.now() < actionsPausedUntil) {
    showStatusMessage(SLOW_DOWN_MESSAGE);
    return;
  }
  try {
    const res = await fetch("/api/own-garden/decorate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ spot, decoration }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const seconds = Number(res.headers.get("retry-after"));
        actionsPausedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 5) * 1000;
      }
      showStatusMessage(body.error ?? "That didn't work just now.");
    }
  } catch {
    showStatusMessage("Couldn't reach the server — try again.");
  }
  decorPicker.querySelector(`[data-id="${id}"]`)?.focus({ preventScroll: true });
});

ownPicker.addEventListener("click", (event) => {
  const option = event.target.closest("button[data-type]");
  if (!option) return;
  ownSelected = option.dataset.type;
  refreshSeeds();
  ownPicker.querySelector(`[data-type="${ownSelected}"]`)?.focus({ preventScroll: true });
});

function openBag(opener) {
  closePlotChoice();
  bagOpener = opener;
  bag.hidden = false;
  for (const button of bagButtons) button.setAttribute("aria-expanded", "true");
  (bagList.querySelector("[aria-checked=true]") ?? document.getElementById("bag-close")).focus({ preventScroll: true });
}

function closeBag() {
  if (bag.hidden) return;
  bag.hidden = true;
  for (const button of bagButtons) button.setAttribute("aria-expanded", "false");
  const back = bagOpener && bagOpener.isConnected && bagOpener.offsetParent !== null ? bagOpener : bagButtons.find((b) => b.offsetParent !== null);
  back?.focus({ preventScroll: true });
}

for (const button of bagButtons) button.addEventListener("click", () => (bag.hidden ? openBag(button) : closeBag()));
document.getElementById("bag-close").addEventListener("click", closeBag);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !bag.hidden && plotChoice.hidden && !photoMode) closeBag();
});

// A gathered plant's seeds fly from it into the bag, which gives a little shake. It
// is only a picture of what the server has already said, and plays only for you.
function shakeBag(button) {
  button.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.12) rotate(-4deg)" }, { transform: "scale(1.06) rotate(3deg)" }, { transform: "scale(1)" }],
    { duration: 420, easing: "ease-out" },
  );
}

function flySeedsToBag(position, type, count) {
  const target = bagButtons.find((button) => button.offsetParent !== null);
  if (!target) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    shakeBag(target);
    return;
  }
  const rect = renderer.domElement.getBoundingClientRect();
  const spot = worldPosition(position);
  const screen = new THREE.Vector3(spot.x, 0.5, spot.z).project(camera);
  const x0 = rect.left + ((screen.x + 1) / 2) * rect.width;
  const y0 = rect.top + ((1 - screen.y) / 2) * rect.height;
  const box = target.getBoundingClientRect();
  const x1 = box.left + box.width / 2;
  const y1 = box.top + box.height / 2;
  for (let i = 0; i < count; i++) {
    const seed = seedPicture(type, "fly-seed");
    document.body.append(seed);
    const rise = 60 + i * 22;
    const animation = seed.animate(
      [
        { transform: `translate(${x0}px, ${y0}px) scale(0.5)`, opacity: 0 },
        { transform: `translate(${x0 + (i - 1) * 16}px, ${y0 - rise}px) scale(1.15)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.45)`, opacity: 0.9 },
      ],
      { duration: 800, delay: i * 120, easing: "ease-in", fill: "backwards" },
    );
    animation.finished.then(
      () => {
        seed.remove();
        if (i === count - 1) shakeBag(target);
      },
      () => seed.remove(),
    );
  }
}

// The recent list: the last few things gardeners did, newest first. The server
// keeps and sends it; this only draws it. It shows no counts and no totals.
const FEED_LENGTH = 3;
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
    if (Array.isArray(hello.beds) && hello.beds.length === BEDS) beds = hello.beds;
    if (Array.isArray(hello.decorations)) decorationList = hello.decorations;
    renderBedSigns();
    renderBedHere();
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
  source.addEventListener("seeds", (event) => renderSeeds(JSON.parse(event.data)));
  source.addEventListener("decorations", (event) => renderDecorations(JSON.parse(event.data)));
  source.addEventListener("own-garden", (event) => {
    for (const plot of JSON.parse(event.data)) applyOwnPlot(plot);
  });
  source.addEventListener("own-update", (event) => applyOwnPlot(JSON.parse(event.data)));
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
// It reads "Waved" for that time, so a click is seen to have done something.
const waveButton = document.getElementById("wave-button");
const waveLabel = waveButton.querySelector("span");
const quickWave = document.getElementById("quick-wave");
function wave() {
  if (waveButton.disabled) return;
  waveButton.disabled = true;
  quickWave.disabled = true;
  waveLabel.textContent = "Waved";
  setTimeout(() => {
    waveButton.disabled = false;
    quickWave.disabled = false;
    waveLabel.textContent = "Wave";
  }, 1500);
  fetch("/api/wave", { method: "POST" }).catch(() => {});
}
waveButton.addEventListener("click", wave);
quickWave.addEventListener("click", wave);

const raycaster = new THREE.Raycaster();
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y);

function ndcFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  );
}

// When the server last told this browser to slow down, until when to hold off.
let actionsPausedUntil = 0;
const SLOW_DOWN_MESSAGE = "Slow down: too many actions, try again in a few seconds";

async function handlePointerClick(event) {
  if (photoMode) return; // the camera only looks: nothing in the garden is touched
  closePlotChoice();
  if (ownMode) return ownClick(event);
  closeBag();
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
  // A fully grown plant can be watered or have its seeds gathered, so ask which.
  if (state === "mature") {
    openPlotChoice(position);
    return;
  }
  sendAction(position, actionFor(state));
}

// Sends one action to the server. The garden changes only when the server's event
// arrives, so this only has to say when something was turned away.
async function sendAction(position, action) {
  // The server has said to slow down: wait until it says to try again, rather than
  // sending clicks it will only turn away.
  if (Date.now() < actionsPausedUntil) {
    showStatusMessage(SLOW_DOWN_MESSAGE);
    return;
  }

  try {
    const res =
      action === "plant"
        ? await fetch(`/api/plots/${position}/plant`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ type: plantHere() }),
          })
        : await fetch(`/api/plots/${position}/${action}`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 429) {
        const seconds = Number(res.headers.get("retry-after"));
        actionsPausedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 5) * 1000;
      }
      showStatusMessage(body.error ?? "That action isn't valid for this plot right now.");
    } else if (action === "gather") {
      // Gathering changes nothing in the garden, so there is no garden event to
      // show it: say what you got. Your seeds arrive on your own stream.
      const name = PLANT_NAME[body.type ?? "tree"].toLowerCase();
      showStatusMessage(`You gathered ${body.gained} ${name} seed${body.gained === 1 ? "" : "s"}`);
      flySeedsToBag(position, body.type ?? "tree", body.gained);
    }
  } catch {
    showStatusMessage("Couldn't reach the server — try again.");
  }
}

// The choice a fully grown plant offers: water it, or gather some of its seeds.
// Gathering never changes the plant.
const plotChoice = document.getElementById("plot-choice");
const plotChoiceLabel = document.getElementById("plot-choice-label");
let choicePosition = null;

function openPlotChoice(position) {
  choicePosition = position;
  const type = plots.get(position)?.plantType ?? "tree";
  plotChoiceLabel.textContent = `${PLANT_NAME[type]}, fully grown`;
  plotChoice.hidden = false;
  document.getElementById("choice-water").focus({ preventScroll: true });
}

function closePlotChoice() {
  choicePosition = null;
  plotChoice.hidden = true;
}

for (const [id, action] of [["choice-water", "water"], ["choice-gather", "gather"]]) {
  document.getElementById(id).addEventListener("click", () => {
    const position = choicePosition;
    closePlotChoice();
    if (position !== null) sendAction(position, action);
  });
}
document.getElementById("choice-cancel").addEventListener("click", closePlotChoice);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !plotChoice.hidden) closePlotChoice();
});

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
  sign.addEventListener("click", () => goToBed(bed));
  sign.addEventListener("pointerenter", () => setHoveredBed(bed));
  sign.addEventListener("pointerleave", () => setHoveredBed(null));
  signTemplate.after(sign);
  return sign;
});
signTemplate.remove();
const signPoint = new THREE.Vector3();

// Label each sign with its bed's name, once the server has given the names.
function renderBedSigns() {
  bedSigns.forEach((sign, bed) => {
    const label = `Go to ${beds[bed].name}`;
    sign.querySelector(".bed-sign-label").textContent = label;
    sign.setAttribute("aria-label", label);
  });
}
renderBedSigns();

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
      !ownMode && bed !== currentBed && !glide && signPoint.z < 1 && x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
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
  if (photoMode) return;
  if (ownMode) return ownPointerMove(event);
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
  clearOwnHover();
  clearHoveredPlot();
  setHoveredBed(null);
  clearStatusBarHover();
});

// Photo mode. The panels, signs and status line step aside and a frame appears over
// the garden, which can be moved and resized and set to a shape. Dragging outside the
// frame still turns the view. It is only a way of looking: while it is open nothing in
// the garden can be clicked, and the server is told nothing.
const PHOTO_SHAPES = { free: null, wide: 16 / 9, square: 1, portrait: 3 / 4 };
const PHOTO_MIN = 80; // the smallest the frame's shorter side can be, in pixels
const photoUi = document.getElementById("photo-ui");
const photoFrameEl = document.getElementById("photo-frame");
const photoShapeButtons = [...document.querySelectorAll("#photo-shapes button")];
const cameraButton = document.getElementById("camera-button");
let photoMode = false;
let photoShape = "wide";
const photoFrame = { x: 0, y: 0, w: 0, h: 0 };

function photoBounds() {
  return { vw: container.clientWidth, vh: container.clientHeight };
}

function applyPhotoFrame() {
  photoFrameEl.style.left = `${photoFrame.x}px`;
  photoFrameEl.style.top = `${photoFrame.y}px`;
  photoFrameEl.style.width = `${photoFrame.w}px`;
  photoFrameEl.style.height = `${photoFrame.h}px`;
}

// Give the frame a shape, keeping its width and centre where the window allows.
function shapePhotoFrame(shape) {
  const { vw, vh } = photoBounds();
  const ratio = PHOTO_SHAPES[shape];
  const cx = photoFrame.x + photoFrame.w / 2;
  const cy = photoFrame.y + photoFrame.h / 2;
  let w = photoFrame.w;
  let h = photoFrame.h;
  if (ratio !== null) {
    h = w / ratio;
    if (h > vh * 0.9) {
      h = vh * 0.9;
      w = h * ratio;
    }
    if (w > vw * 0.9) {
      w = vw * 0.9;
      h = w / ratio;
    }
  }
  w = Math.min(Math.max(w, PHOTO_MIN), vw);
  h = Math.min(Math.max(h, PHOTO_MIN), vh);
  photoFrame.w = w;
  photoFrame.h = h;
  photoFrame.x = Math.min(Math.max(cx - w / 2, 0), vw - w);
  photoFrame.y = Math.min(Math.max(cy - h / 2, 0), vh - h);
  applyPhotoFrame();
}

function setPhotoShape(shape) {
  photoShape = shape;
  photoShapeButtons.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.shape === shape)));
  shapePhotoFrame(shape);
}

function openPhotoMode() {
  closePlotChoice();
  closeBag();
  if (photoMode) return;
  photoMode = true;
  clearHoveredPlot();
  setHoveredBed(null);
  clearStatusBarHover();
  document.body.classList.add("photo-mode");
  photoUi.hidden = false;
  updateViewOffset();
  const { vw, vh } = photoBounds();
  photoFrame.w = Math.min(vw * 0.7, vh * 0.7 * (16 / 9));
  photoFrame.h = photoFrame.w * (9 / 16);
  photoFrame.x = (vw - photoFrame.w) / 2;
  photoFrame.y = (vh - photoFrame.h) / 2;
  setPhotoShape(photoShape);
  photoFrameEl.focus({ preventScroll: true });
}

function closePhotoMode() {
  if (!photoMode) return;
  photoMode = false;
  photoRequested = false;
  photoShutter.disabled = false;
  clearPhoto();
  showPhotoPreview(false);
  document.body.classList.remove("photo-mode");
  photoUi.hidden = true;
  updateViewOffset();
  // Back to whichever button opened it: the journal's, or the floating one on a phone.
  (photoOpener && photoOpener.isConnected && photoOpener.offsetParent !== null ? photoOpener : cameraButton).focus({ preventScroll: true });
}

// Taking the photo: copy the part of the canvas inside the frame into a smaller
// picture. It stays in this page, and the server is told nothing.
const PHOTO_MAX_EDGE = 1600; // the longest side of a saved photo, in pixels
const photoPreview = document.getElementById("photo-preview");
const photoPreviewImg = document.getElementById("photo-preview-img");
const photoFlash = document.getElementById("photo-flash");
const photoShutter = document.getElementById("photo-shutter");
let photoRequested = false;
let photoUrl = null;
let photoBlob = null;

function takePhoto() {
  photoRequested = false;
  const canvas = renderer.domElement;
  const scale = canvas.width / container.clientWidth;
  const sx = Math.round(photoFrame.x * scale);
  const sy = Math.round(photoFrame.y * scale);
  const sw = Math.max(1, Math.min(Math.round(photoFrame.w * scale), canvas.width - sx));
  const sh = Math.max(1, Math.min(Math.round(photoFrame.h * scale), canvas.height - sy));
  const shrink = Math.min(1, PHOTO_MAX_EDGE / Math.max(sw, sh));
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(sw * shrink));
  out.height = Math.max(1, Math.round(sh * shrink));
  out.getContext("2d").drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  photoFlash.classList.remove("is-flashing");
  void photoFlash.offsetWidth; // so the flash can play again
  photoFlash.classList.add("is-flashing");
  out.toBlob(
    (blob) => {
      photoShutter.disabled = false;
      if (!blob || !photoMode) return;
      clearPhoto();
      photoBlob = blob;
      photoTakenAt = Date.now();
      photoUrl = URL.createObjectURL(blob);
      photoPreviewImg.src = photoUrl;
      showPhotoPreview(true);
    },
    "image/jpeg",
    0.85,
  );
}

function clearPhoto() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null;
  photoBlob = null;
  photoPreviewImg.removeAttribute("src");
}

// While the photo is shown, the frame and the bar step aside.
function showPhotoPreview(show) {
  photoPreview.hidden = !show;
  if (show) {
    photoSave.disabled = false;
    photoNote.textContent = "";
  }
  photoFrameEl.hidden = show;
  document.getElementById("photo-hint").hidden = show;
  document.getElementById("photo-bar").hidden = show;
  if (show) document.getElementById("photo-download").focus({ preventScroll: true });
  else photoFrameEl.focus({ preventScroll: true });
}

photoShutter.addEventListener("click", () => {
  if (photoRequested || !photoMode) return;
  photoShutter.disabled = true;
  photoRequested = true;
});
document.getElementById("photo-retake").addEventListener("click", () => {
  clearPhoto();
  showPhotoPreview(false);
});
// Hand a picture to the browser as a file, named for when it was taken.
function downloadPhoto(url, takenAt) {
  const t = new Date(takenAt);
  const pad = (n) => String(n).padStart(2, "0");
  const link = document.createElement("a");
  link.href = url;
  link.download = `community-garden-${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
document.getElementById("photo-download").addEventListener("click", () => {
  if (photoUrl) downloadPhoto(photoUrl, photoTakenAt);
});

// The album: photos kept in this browser's own storage (IndexedDB), never sent
// anywhere. Each is stored with a small thumbnail so the grid stays light. There is
// room for ALBUM_CAP photos; when it is full a new one is turned away with a message
// and nothing is dropped. If the browser won't give storage, the camera still works
// and photos can be saved to the device.
const ALBUM_CAP = 24;
const THUMB_EDGE = 240;
const albumGrid = document.getElementById("album-grid");
const albumNote = document.getElementById("album-note");
const albumDetails = document.getElementById("album");
const photoSave = document.getElementById("photo-save");
const photoNote = document.getElementById("photo-note");
let albumDb = null;
let albumPhotos = []; // newest first: { id, blob, thumbUrl, takenAt }
let photoTakenAt = Date.now();

function openAlbumDb() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open("garden-album", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("photos", { keyPath: "id", autoIncrement: true });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("blocked"));
    } catch (error) {
      reject(error);
    }
  });
}

function albumRequest(mode, work) {
  return new Promise((resolve, reject) => {
    const tx = albumDb.transaction("photos", mode);
    const request = work(tx.objectStore("photos"));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function renderAlbum() {
  albumGrid.replaceChildren();
  for (const photo of albumPhotos) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", `Photo taken ${new Date(photo.takenAt).toLocaleString()}`);
    const img = document.createElement("img");
    img.src = photo.thumbUrl;
    img.alt = "";
    button.appendChild(img);
    button.addEventListener("click", () => openAlbumView(photo));
    albumGrid.appendChild(button);
  }
  if (!albumDb) albumNote.textContent = "Your browser won't keep photos here, so use Save to device.";
  else albumNote.textContent = albumPhotos.length ? "Kept in this browser only. Nobody else sees them." : "No photos yet. Photos you take are kept in this browser only.";
  updateViewOffset();
}

async function loadAlbum() {
  try {
    albumDb = await openAlbumDb();
    const rows = await albumRequest("readonly", (store) => store.getAll());
    rows.sort((a, b) => b.takenAt - a.takenAt);
    albumPhotos = rows.map((r) => ({ id: r.id, blob: r.blob, thumbUrl: URL.createObjectURL(r.thumb), takenAt: r.takenAt }));
  } catch {
    albumDb = null;
    albumPhotos = [];
  }
  renderAlbum();
}
loadAlbum();
albumDetails.addEventListener("toggle", updateViewOffset);

async function makeThumb(blob) {
  const bitmap = await createImageBitmap(blob);
  const shrink = Math.min(1, THUMB_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * shrink));
  canvas.height = Math.max(1, Math.round(bitmap.height * shrink));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("thumb"))), "image/jpeg", 0.8));
}

photoSave.addEventListener("click", async () => {
  if (!photoBlob) return;
  if (!albumDb) {
    photoNote.textContent = "Your browser won't keep photos here. Use Save to device instead.";
    return;
  }
  if (albumPhotos.length >= ALBUM_CAP) {
    photoNote.textContent = "Your album is full. Save this one to your device, or delete a photo from the album first.";
    return;
  }
  photoSave.disabled = true;
  try {
    const takenAt = photoTakenAt;
    const thumb = await makeThumb(photoBlob);
    await albumRequest("readwrite", (store) => store.add({ blob: photoBlob, thumb, takenAt }));
    await loadAlbum();
    photoNote.textContent = "Saved to your album.";
  } catch {
    photoSave.disabled = false;
    photoNote.textContent = "Couldn't save to the album. Use Save to device instead.";
  }
});

// A kept photo, larger, with a way to save it to the device or delete it.
const albumView = document.getElementById("album-view");
const albumViewImg = document.getElementById("album-view-img");
const albumDelete = document.getElementById("album-delete");
let albumViewing = null;
let albumViewUrl = null;

function openAlbumView(photo) {
  albumViewing = photo;
  albumViewUrl = URL.createObjectURL(photo.blob);
  albumViewImg.src = albumViewUrl;
  resetAlbumDelete();
  albumView.hidden = false;
  document.body.classList.add("album-open");
  document.getElementById("album-save").focus({ preventScroll: true });
}

function closeAlbumView() {
  if (albumView.hidden) return;
  albumView.hidden = true;
  document.body.classList.remove("album-open");
  albumViewImg.removeAttribute("src");
  if (albumViewUrl) URL.revokeObjectURL(albumViewUrl);
  albumViewUrl = null;
  albumViewing = null;
}

function resetAlbumDelete() {
  albumDelete.textContent = "Delete";
  albumDelete.classList.remove("is-sure");
}

document.getElementById("album-close").addEventListener("click", closeAlbumView);
document.getElementById("album-save").addEventListener("click", () => {
  if (albumViewing) downloadPhoto(albumViewUrl, albumViewing.takenAt);
});
// Deleting asks twice, in the button itself, since it can't be undone.
albumDelete.addEventListener("click", async () => {
  if (!albumViewing) return;
  if (!albumDelete.classList.contains("is-sure")) {
    albumDelete.textContent = "Really delete?";
    albumDelete.classList.add("is-sure");
    return;
  }
  const { id } = albumViewing;
  try {
    await albumRequest("readwrite", (store) => store.delete(id));
  } catch {
    albumDelete.textContent = "Couldn't delete";
    return;
  }
  const gone = albumPhotos.find((p) => p.id === id);
  if (gone) URL.revokeObjectURL(gone.thumbUrl);
  albumPhotos = albumPhotos.filter((p) => p.id !== id);
  closeAlbumView();
  renderAlbum();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeAlbumView();
});

let photoOpener = null;
for (const button of [cameraButton, document.getElementById("quick-camera")]) {
  button.addEventListener("click", () => {
    photoOpener = button;
    openPhotoMode();
  });
}
document.getElementById("photo-close").addEventListener("click", closePhotoMode);
document.getElementById("photo-done").addEventListener("click", closePhotoMode);
document.addEventListener("keydown", (event) => {
  if (photoMode && event.key === "Escape") closePhotoMode();
});
photoShapeButtons.forEach((b) => b.addEventListener("click", () => setPhotoShape(b.dataset.shape)));
window.addEventListener("resize", () => {
  if (photoMode) shapePhotoFrame(photoShape);
});

// Dragging the frame moves it; dragging a corner resizes it from the opposite corner.
// Scale the frame about its centre, keeping its shape, as far as the window allows.
// Pinching and the keyboard both use it.
function scalePhotoFrame(from, scale) {
  const { vw, vh } = photoBounds();
  const lowest = Math.max(PHOTO_MIN / from.w, PHOTO_MIN / from.h);
  const highest = Math.min(vw / from.w, vh / from.h);
  const s = Math.min(Math.max(scale, Math.min(lowest, highest)), highest);
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  photoFrame.w = from.w * s;
  photoFrame.h = from.h * s;
  photoFrame.x = Math.min(Math.max(cx - photoFrame.w / 2, 0), vw - photoFrame.w);
  photoFrame.y = Math.min(Math.max(cy - photoFrame.h / 2, 0), vh - photoFrame.h);
  applyPhotoFrame();
}

// One finger or the mouse drags; a second finger on the frame turns it into a pinch.
let photoDrag = null;
let photoPinch = null;
const photoPointers = new Map();
photoFrameEl.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  photoPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  photoFrameEl.setPointerCapture(event.pointerId);
  event.preventDefault();
  if (photoPointers.size === 2) {
    const [a, b] = [...photoPointers.values()];
    photoDrag = null;
    photoPinch = { start: Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1), from: { ...photoFrame } };
    return;
  }
  if (photoPointers.size > 2) return;
  const corner = event.target.dataset ? event.target.dataset.corner : undefined;
  photoDrag = { corner, startX: event.clientX, startY: event.clientY, from: { ...photoFrame } };
});
photoFrameEl.addEventListener("pointermove", (event) => {
  if (photoPointers.has(event.pointerId)) photoPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (photoPinch) {
    const [a, b] = [...photoPointers.values()];
    scalePhotoFrame(photoPinch.from, Math.hypot(a.x - b.x, a.y - b.y) / photoPinch.start);
    return;
  }
  if (!photoDrag) return;
  const { vw, vh } = photoBounds();
  const { corner, from } = photoDrag;
  if (!corner) {
    photoFrame.x = Math.min(Math.max(from.x + event.clientX - photoDrag.startX, 0), vw - from.w);
    photoFrame.y = Math.min(Math.max(from.y + event.clientY - photoDrag.startY, 0), vh - from.h);
    applyPhotoFrame();
    return;
  }
  // The corner opposite the one being dragged stays where it is.
  const sx = corner.includes("e") ? 1 : -1;
  const sy = corner.includes("s") ? 1 : -1;
  const ax = sx > 0 ? from.x : from.x + from.w;
  const ay = sy > 0 ? from.y : from.y + from.h;
  const dx = Math.max((event.clientX - ax) * sx, 0);
  const dy = Math.max((event.clientY - ay) * sy, 0);
  const maxW = sx > 0 ? vw - ax : ax;
  const maxH = sy > 0 ? vh - ay : ay;
  const ratio = PHOTO_SHAPES[photoShape];
  let w;
  let h;
  if (ratio === null) {
    w = Math.min(Math.max(dx, PHOTO_MIN), maxW);
    h = Math.min(Math.max(dy, PHOTO_MIN), maxH);
  } else {
    w = Math.max(dx, dy * ratio);
    w = Math.max(w, PHOTO_MIN * Math.max(1, ratio));
    w = Math.min(w, maxW, maxH * ratio);
    h = w / ratio;
  }
  photoFrame.w = w;
  photoFrame.h = h;
  photoFrame.x = sx > 0 ? ax : ax - w;
  photoFrame.y = sy > 0 ? ay : ay - h;
  applyPhotoFrame();
});
const endPhotoDrag = (event) => {
  photoPointers.delete(event.pointerId);
  photoDrag = null;
  // Lifting one finger of a pinch ends it, and the other finger does nothing more.
  if (photoPointers.size < 2) photoPinch = null;
};
photoFrameEl.addEventListener("pointerup", endPhotoDrag);
photoFrameEl.addEventListener("pointercancel", endPhotoDrag);

// The keyboard: arrows move the frame, Shift with an arrow makes it larger or smaller,
// and Enter takes the photo.
photoFrameEl.addEventListener("keydown", (event) => {
  const { vw, vh } = photoBounds();
  const step = 10;
  if (event.key === "Enter") {
    event.preventDefault();
    photoShutter.click();
    return;
  }
  const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!dir) return;
  event.preventDefault();
  if (event.shiftKey) {
    // Right or down grows the frame and left or up shrinks it.
    const grow = dir[0] + dir[1];
    scalePhotoFrame({ ...photoFrame }, 1 + grow * 0.05);
    return;
  }
  photoFrame.x = Math.min(Math.max(photoFrame.x + dir[0] * step, 0), vw - photoFrame.w);
  photoFrame.y = Math.min(Math.max(photoFrame.y + dir[1] * step, 0), vh - photoFrame.h);
  applyPhotoFrame();
});

// The frame sits over the canvas, so pass the scroll wheel on to zoom the view.
photoFrameEl.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    renderer.domElement.dispatchEvent(
      new WheelEvent("wheel", {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  },
  { passive: false },
);

// Cows: a few wander the open grass beyond the garden, for show only. Each has a
// patch of lawn of its own, so they never meet or come near the beds, fences or
// paths. Where a cow is, which way it faces and whether its head is down are a pure
// function of the server's clock, so every visitor sees the cows in the same places
// with nothing sent over the wire. They cannot be clicked and nothing depends on them.
const COW_COUNT = 5;
const COW_SEGMENT_S = 30; // how long one walk-then-graze cycle lasts
const COW_COLOURS = {
  white: 0xf2efe6,
  black: 0x2a2724,
  brown: 0x8a5a36,
  pink: 0xe8b4a8,
  horn: 0xe6dcc0,
  hoof: 0x3a3330,
};
const cowMaterials = Object.fromEntries(Object.entries(COW_COLOURS).map(([name, colour]) => [name, flatMaterial(colour)]));

// A rounded lump: a low-poly ellipsoid, the same way the tree crowns are made.
const cowBlobGeometry = new THREE.SphereGeometry(1, 8, 6);
const cowBlob = (rx, ry, rz, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(cowBlobGeometry, material);
  mesh.scale.set(rx, ry, rz);
  mesh.position.set(x, y, z);
  return mesh;
};

// One cow faces +x. Its legs, neck and tail hang from pivots so they can swing and
// nod. The spots are flattened lumps that poke out of the body, never faces lying
// on the same plane as the body, so they cannot flicker against it.
function buildCow(index) {
  const brown = index === 1 || index === 4;
  const coat = brown ? cowMaterials.brown : cowMaterials.white;
  const patch = brown ? cowMaterials.white : cowMaterials.black;
  const group = new THREE.Group();

  const body = new THREE.Group();
  body.position.y = 0.7;
  body.add(cowBlob(0.7, 0.36, 0.33, coat));
  body.add(cowBlob(0.38, 0.38, 0.34, coat, 0.36, 0.02, 0)); // chest
  body.add(cowBlob(0.36, 0.37, 0.34, coat, -0.4, 0.02, 0)); // hindquarters
  body.add(cowBlob(0.22, 0.12, 0.2, coat, 0.45, 0.34, 0)); // shoulder hump
  body.add(cowBlob(0.2, 0.12, 0.22, cowMaterials.pink, -0.38, -0.32, 0)); // udder
  for (const side of [1, -1]) {
    // A few spots on each flank, a different set for every cow.
    for (let k = 0; k < 3; k++) {
      const r = (n) => seeded(index * 31 + k * 7 + (side > 0 ? 0 : 50) + n);
      body.add(
        cowBlob(0.1 + r(1) * 0.14, 0.09 + r(2) * 0.12, 0.07, patch, -0.55 + k * 0.5 + (r(3) - 0.5) * 0.18, (r(4) - 0.35) * 0.28, side * (0.3 - r(5) * 0.02)),
      );
    }
  }
  group.add(body);

  const legs = [];
  for (const [x, z] of [[0.46, 0.2], [0.46, -0.2], [-0.46, 0.2], [-0.46, -0.2]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.5, z);
    pivot.add(cowBlob(0.1, 0.17, 0.1, coat, 0, -0.1, 0)); // thigh
    pivot.add(cowBlob(0.065, 0.16, 0.065, coat, 0, -0.3, 0)); // shin
    pivot.add(cowBlob(0.08, 0.05, 0.08, cowMaterials.hoof, 0, -0.47, 0.005)); // hoof
    group.add(pivot);
    legs.push(pivot);
  }

  // The neck and head swing together from the top of the chest.
  const head = new THREE.Group();
  head.position.set(0.62, 0.9, 0);
  head.add(cowBlob(0.26, 0.17, 0.17, coat, 0.16, -0.02, 0)); // neck
  head.add(cowBlob(0.17, 0.15, 0.15, coat, 0.38, -0.04, 0)); // skull
  head.add(cowBlob(0.11, 0.1, 0.12, cowMaterials.pink, 0.55, -0.1, 0)); // muzzle
  head.add(cowBlob(0.025, 0.03, 0.03, cowMaterials.black, 0.62, -0.08, 0.05)); // nostrils
  head.add(cowBlob(0.025, 0.03, 0.03, cowMaterials.black, 0.62, -0.08, -0.05));
  head.add(cowBlob(0.025, 0.03, 0.03, cowMaterials.black, 0.45, 0.02, 0.135)); // eyes
  head.add(cowBlob(0.025, 0.03, 0.03, cowMaterials.black, 0.45, 0.02, -0.135));
  if (brown) head.add(cowBlob(0.1, 0.1, 0.07, cowMaterials.white, 0.46, -0.03, 0)); // blaze down the face
  else head.add(cowBlob(0.1, 0.07, 0.17, patch, 0.33, 0.06, 0)); // dark cap
  for (const side of [1, -1]) {
    const ear = cowBlob(0.05, 0.03, 0.1, brown ? cowMaterials.brown : cowMaterials.black, 0.27, 0.07, side * 0.22);
    ear.rotation.x = side * -0.4;
    head.add(ear);
    head.add(cowBlob(0.025, 0.07, 0.025, cowMaterials.horn, 0.3, 0.17, side * 0.1));
  }
  group.add(head);

  const tail = new THREE.Group();
  tail.position.set(-0.74, 0.88, 0);
  tail.add(cowBlob(0.025, 0.24, 0.025, coat, 0, -0.22, 0));
  tail.add(cowBlob(0.045, 0.09, 0.045, patch, 0, -0.5, 0));
  group.add(tail);

  group.scale.setScalar(1.15);
  return { group, legs, head, tail };
}

// Each cow keeps to its own slice of the lawn, a ring round the garden.
const cows = Array.from({ length: COW_COUNT }, (_, i) => {
  const cow = buildCow(i);
  const angle = ((i + 0.3 * seeded(i + 5)) / COW_COUNT) * Math.PI * 2 + 0.4;
  // The last cow's patch is pushed out a little further, to keep clear of the cottage.
  const radius = 21 + seeded(i * 3 + 1) * 5 + (i === 4 ? 2 : 0);
  cow.home = {
    x: GARDEN_CENTRE.x + Math.cos(angle) * radius,
    z: GARDEN_CENTRE.z + Math.sin(angle) * radius,
  };
  cow.group.position.y = GROUND_Y;
  scene.add(cow.group);
  return cow;
});

// A spot within a few steps of the cow's home, a different one for each cycle.
function cowSpot(cow, index, cycle) {
  const a = seeded(index * 101 + cycle * 7.3) * Math.PI * 2;
  const r = 1.2 + seeded(index * 57 + cycle * 3.1) * 2.6;
  return { x: cow.home.x + Math.cos(a) * r, z: cow.home.z + Math.sin(a) * r };
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);

function updateCows(timeSeconds) {
  cows.forEach((cow, i) => {
    const t = timeSeconds / COW_SEGMENT_S + i * 0.37;
    const cycle = Math.floor(t);
    const p = t - cycle;
    const from = cowSpot(cow, i, cycle);
    const to = cowSpot(cow, i, cycle + 1);
    const headingTo = Math.atan2(-(to.z - from.z), to.x - from.x);
    const before = cowSpot(cow, i, cycle - 1);
    const headingFrom = Math.atan2(-(from.z - before.z), from.x - before.x);

    // First turn to face the next spot, then walk to it, then graze until the next cycle.
    const turn = smooth(clamp01(p / 0.12));
    let delta = headingTo - headingFrom;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    const walk = smooth(clamp01((p - 0.12) / 0.38));
    cow.group.rotation.y = headingFrom + delta * turn;
    cow.group.position.x = from.x + (to.x - from.x) * walk;
    cow.group.position.z = from.z + (to.z - from.z) * walk;

    const walking = p > 0.12 && p < 0.5 ? Math.sin(((p - 0.12) / 0.38) * Math.PI) ** 0.5 : 0;
    const stride = Math.sin(timeSeconds * 5 + i) * 0.45 * walking;
    cow.legs[0].rotation.z = stride;
    cow.legs[3].rotation.z = stride;
    cow.legs[1].rotation.z = -stride;
    cow.legs[2].rotation.z = -stride;

    // Head up while walking, down to graze for most of the rest, up again before moving off.
    const lower = smooth(clamp01((p - 0.5) / 0.08)) * (1 - smooth(clamp01((p - 0.9) / 0.08)));
    const chew = Math.sin(timeSeconds * 2.4 + i * 2) * 0.06 * lower;
    cow.head.rotation.z = 0.08 - 0.95 * lower + chew;
    cow.tail.rotation.x = Math.sin(timeSeconds * 1.8 + i * 1.3) * 0.3;
  });
}

// The far edge of the world, all for show: layered ridges of hills, and belts of trees in
// front of them, so the lawn ends in a skyline. None of it is sent anything by the server,
// nothing can be clicked, and nothing depends on it. The fog would turn it all to mist, so
// it is hazed by hand instead: lit like the rest of the scene, then mixed toward the sky
// colour, more for what is further away.
const hillBase = new THREE.Color();

// A ring of hills as one strip of triangles. The height rises and falls smoothly all the
// way round and meets itself where it started.
function ridgeGeometry(radius, base, amp, seed) {
  const segments = 200;
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const wave = 0.55 * Math.sin(a * 2 + seed) + 0.3 * Math.sin(a * 5 + seed * 2.3) + 0.15 * Math.sin(a * 11 + seed * 4.1);
    const x = GARDEN_CENTRE.x + Math.cos(a) * radius;
    const z = GARDEN_CENTRE.z + Math.sin(a) * radius;
    positions.push(x, GROUND_Y - 2, z, x, GROUND_Y + base + amp * (0.5 + 0.5 * wave), z);
    if (i < segments) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

const hillRings = [
  { radius: 76, base: 7, amp: 10, seed: 1.1, haze: 0.66, colour: 0x7fa890 },
  { radius: 68, base: 4.5, amp: 6.5, seed: 3.7, haze: 0.5, colour: 0x6c9c6c },
  { radius: 60, base: 2.6, amp: 4.2, seed: 6.2, haze: 0.34, colour: 0x5a8e54 },
].map((ring) => {
  const material = new THREE.MeshBasicMaterial({ color: ring.colour, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(ridgeGeometry(ring.radius, ring.base, ring.amp, ring.seed), material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return { material, ...ring };
});

// Merge a handful of shapes, each with its own colour, into one geometry, so a whole tree
// is one thing to draw and a belt of them one instanced mesh.
function mergeParts(parts) {
  const positions = [];
  const normals = [];
  const colours = [];
  for (const { geometry, colour, position = [0, 0, 0], scale = [1, 1, 1] } of parts) {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    piece.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion(), new THREE.Vector3(...scale)));
    const paint = new THREE.Color(colour);
    for (let i = 0; i < piece.attributes.position.count; i++) {
      positions.push(piece.attributes.position.getX(i), piece.attributes.position.getY(i), piece.attributes.position.getZ(i));
      normals.push(piece.attributes.normal.getX(i), piece.attributes.normal.getY(i), piece.attributes.normal.getZ(i));
      colours.push(paint.r, paint.g, paint.b);
    }
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  return merged;
}

const trunkParts = (height, colour) => ({ geometry: new THREE.CylinderGeometry(0.12, 0.18, height, 6), colour, position: [0, height / 2, 0] });
// A fir: a trunk and three tiers of needles, each narrower than the one below.
const firGeometry = mergeParts([
  trunkParts(0.7, 0x5b3d26),
  { geometry: new THREE.ConeGeometry(1.0, 1.3, 7), colour: 0x2f6b46, position: [0, 1.1, 0] },
  { geometry: new THREE.ConeGeometry(0.78, 1.15, 7), colour: 0x3a7b4f, position: [0, 1.75, 0] },
  { geometry: new THREE.ConeGeometry(0.54, 1.05, 7), colour: 0x468b58, position: [0, 2.4, 0] },
]);
// A broadleaf: a bare trunk under a crown made of several clumps of leaves.
const leafyGeometry = mergeParts([
  trunkParts(1.3, 0x6b4a2e),
  ...[
    [0, 1.9, 0, 0.95, 0x5a9a47],
    [0.55, 1.6, 0.2, 0.65, 0x4c8a3f],
    [-0.5, 1.65, -0.25, 0.7, 0x55964a],
    [0.1, 2.45, -0.1, 0.66, 0x72b259],
    [-0.25, 2.2, 0.45, 0.5, 0x4a8640],
  ].map(([x, y, z, r, colour]) => ({ geometry: new THREE.IcosahedronGeometry(1, 1), colour, position: [x, y, z], scale: [r, r * 0.88, r] })),
]);

const TREE_BELTS = [
  { inner: 32, outer: 40, count: 80, haze: 0.16, size: [1.5, 2.6] },
  { inner: 43, outer: 54, count: 130, haze: 0.38, size: [2.0, 3.4] },
].map((belt, beltIndex) => {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, fog: false });
  const firs = new THREE.InstancedMesh(firGeometry, material, belt.count);
  const leafy = new THREE.InstancedMesh(leafyGeometry, material, belt.count);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let firN = 0;
  let leafyN = 0;
  for (let i = 0; i < belt.count; i++) {
    const r = (n) => seeded(900 + beltIndex * 400 + i * 13 + n);
    const angle = (i / belt.count) * Math.PI * 2 + (r(1) - 0.5) * 0.08;
    // Thin the belt out in a slow wave so the trees come in clumps with gaps between.
    if (Math.sin(angle * 5 + 1.3 + beltIndex * 2) + (r(2) - 0.5) * 1.1 < -0.35) continue;
    const radius = belt.inner + r(3) * (belt.outer - belt.inner);
    const size = belt.size[0] + r(4) * (belt.size[1] - belt.size[0]);
    dummy.position.set(GARDEN_CENTRE.x + Math.cos(angle) * radius, GROUND_Y, GARDEN_CENTRE.z + Math.sin(angle) * radius);
    dummy.rotation.set(0, r(6) * 6.28, 0);
    dummy.scale.set(size, size * (0.9 + r(9) * 0.3), size);
    dummy.updateMatrix();
    tint.setRGB(0.82 + r(7) * 0.2, 0.84 + r(8) * 0.18, 0.78 + r(7) * 0.2);
    if (r(5) < 0.55) {
      firs.setMatrixAt(firN, dummy.matrix);
      firs.setColorAt(firN++, tint);
    } else {
      leafy.setMatrixAt(leafyN, dummy.matrix);
      leafy.setColorAt(leafyN++, tint);
    }
  }
  firs.count = firN;
  leafy.count = leafyN;
  for (const mesh of [firs, leafy]) {
    mesh.frustumCulled = false;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
  }
  return { material, ...belt };
});

function updateHills() {
  for (const ring of hillRings) {
    hillBase.set(ring.colour);
    for (const channel of ["r", "g", "b"]) {
      hillBase[channel] *= Math.min(1, ambient.color[channel] * ambient.intensity * 1.4);
    }
    ring.material.color.copy(hillBase).lerp(skyColour, ring.haze);
  }
  // The trees keep their own colours and shading; the haze is added on top, as fog would.
  for (const belt of TREE_BELTS) {
    belt.material.color.setScalar(1 - belt.haze);
    belt.material.emissive.copy(skyColour).multiplyScalar(belt.haze);
  }
}

// A cottage behind the garden, facing it: cream walls, a honey-coloured thatch with
// scalloped eaves, a round-topped door, shutters with hearts, a crooked chimney with
// smoke, toadstools in the grass and a swing from the tree. The windows and the lantern
// glow once the sun has gone down. It stands well clear of the beds, the paths and the
// cows' patches, and a dirt lane winds from its gate to the gardens. All for show.
const COTTAGE_AT = { x: 18, z: -25 };
const COTTAGE_SCALE = 1.5;
const cottageMat = {
  wall: flatMaterial(0xfdf1dc),
  stone: flatMaterial(0xb8a999),
  thatch: [flatMaterial(0xdcb25a), flatMaterial(0xc99a45), flatMaterial(0xb8873a)],
  wood: flatMaterial(0x7a5230),
  door: flatMaterial(0x5fb0a4),
  pink: flatMaterial(0xec8fab),
  mint: flatMaterial(0x93d4b8),
  trim: flatMaterial(0xfffaf0),
  gold: flatMaterial(0xf2c14e),
  leaf: flatMaterial(0x4f8a46),
  leafLight: flatMaterial(0x62a455),
  stem: flatMaterial(0x5a8f48),
  toadstool: flatMaterial(0xe0524a),
  white: flatMaterial(0xffffff),
};
const cottageGlass = new THREE.MeshBasicMaterial({ color: 0x9ec4d8, side: THREE.DoubleSide });
const lanternGlass = new THREE.MeshBasicMaterial({ color: 0xe8cf9a });
const glassDay = new THREE.Color(0x9ec4d8);
const glassNight = new THREE.Color(0xffc45e);
const lanternDay = new THREE.Color(0xe8cf9a);
const lanternNight = new THREE.Color(0xffd66e);
const smokeMaterial = new THREE.MeshBasicMaterial({ color: 0xe9e7e3, transparent: true, depthWrite: false });
const BLOOMS = [0xe86a8a, 0xf5d24a, 0xc58cf0, 0xff9a5a, 0xffffff];
const bloomMaterials = BLOOMS.map((colour) => flatMaterial(colour));
const cottageSmoke = [];
let cottageSwing = null;
let cottageGroup = null;

function buildCottage() {
  const group = new THREE.Group();
  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  const box = (w, h, d, material, x, y, z) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material), x, y, z);
  const ball = (rx, ry, rz, material, x, y, z) => add(cowBlob(rx, ry, rz, material), x, y, z);
  const heart = (x, y, z, size, material) => {
    ball(size, size, size * 0.4, material, x - size * 0.55, y + size * 0.3, z);
    ball(size, size, size * 0.4, material, x + size * 0.55, y + size * 0.3, z);
    const point = box(size * 1.5, size * 1.5, size * 0.4, material, x, y - size * 0.15, z);
    point.rotation.z = Math.PI / 4;
  };

  // Walls on a stone footing, and a tall gable at each end.
  box(4.5, 0.3, 3.3, cottageMat.stone, 0, 0.15, 0);
  box(4.2, 1.8, 3.0, cottageMat.wall, 0, 1.2, 0);
  const gableShape = new THREE.Shape([new THREE.Vector2(-1.5, 0), new THREE.Vector2(1.5, 0), new THREE.Vector2(0, 1.6)]);
  const gableGeometry = new THREE.ExtrudeGeometry(gableShape, { depth: 4.2, bevelEnabled: false });
  gableGeometry.translate(0, 0, -2.1);
  gableGeometry.rotateY(Math.PI / 2);
  add(new THREE.Mesh(gableGeometry, cottageMat.wall), 0, 2.1, 0);

  // The thatch: two thick slabs that overhang, a row of rounded bundles along each eave
  // to make it scalloped, and a rolled ridge with a knob at each end.
  const pitch = Math.atan2(1.6, 1.5);
  for (const side of [1, -1]) {
    const slab = box(4.9, 0.26, 2.5, cottageMat.thatch[side > 0 ? 0 : 1], 0, 2.9, side * 0.75);
    slab.rotation.x = side * pitch;
    for (let x = -2.2; x <= 2.21; x += 0.3) {
      ball(0.2, 0.14, 0.2, cottageMat.thatch[2], x, 1.96, side * 1.64);
    }
  }
  const ridge = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.0, 8), cottageMat.thatch[2]), 0, 3.74, 0);
  ridge.rotation.z = Math.PI / 2;
  ball(0.17, 0.17, 0.17, cottageMat.thatch[2], -2.5, 3.74, 0);
  ball(0.17, 0.17, 0.17, cottageMat.thatch[2], 2.5, 3.74, 0);

  // A little dormer window poking out of the front slope, with a tiny thatch roof of its own.
  box(0.9, 0.66, 0.62, cottageMat.wall, 1.0, 2.95, 1.0);
  add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), cottageGlass), 1.0, 2.95, 1.32);
  box(0.62, 0.05, 0.05, cottageMat.trim, 1.0, 2.95, 1.335);
  box(0.05, 0.42, 0.05, cottageMat.trim, 1.0, 2.95, 1.335);
  for (const side of [1, -1]) {
    const part = box(0.62, 0.06, 0.82, cottageMat.thatch[side > 0 ? 0 : 1], 1.0 + side * 0.22, 3.42, 1.05);
    part.rotation.z = -side * 0.75;
  }
  ball(0.07, 0.07, 0.07, cottageMat.gold, 1.0, 3.7, 1.05);

  // The front door is round at the top, in a stone arch, with a step and a golden knob.
  const archRect = box(1.0, 1.05, 0.08, cottageMat.stone, -0.3, 0.83, 1.5);
  const arch = add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 16, 1, false, Math.PI / 2, Math.PI), cottageMat.stone), -0.3, 1.355, 1.5);
  arch.rotation.x = Math.PI / 2;
  box(0.8, 1.0, 0.1, cottageMat.door, -0.3, 0.8, 1.53);
  const doorTop = add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16, 1, false, Math.PI / 2, Math.PI), cottageMat.door), -0.3, 1.3, 1.53);
  doorTop.rotation.x = Math.PI / 2;
  ball(0.045, 0.045, 0.045, cottageMat.gold, -0.05, 1.0, 1.6);
  box(1.1, 0.12, 0.5, cottageMat.stone, -0.3, 0.36, 1.78);
  void archRect;

  // Two windows with crossbars, a heart on each shutter, and a box of flowers beneath.
  [[-1.55, cottageMat.pink], [1.15, cottageMat.mint]].forEach(([x, shutter], n) => {
    box(0.86, 0.78, 0.08, cottageMat.trim, x, 1.4, 1.52);
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.58), cottageGlass), x, 1.4, 1.565);
    box(0.66, 0.05, 0.05, cottageMat.trim, x, 1.4, 1.58);
    box(0.05, 0.6, 0.05, cottageMat.trim, x, 1.4, 1.58);
    for (const side of [-1, 1]) {
      box(0.24, 0.78, 0.07, shutter, x + side * 0.56, 1.4, 1.53);
      heart(x + side * 0.56, 1.45, 1.575, 0.045, cottageMat.trim);
    }
    box(0.9, 0.15, 0.22, cottageMat.wood, x, 0.93, 1.63);
    for (let k = 0; k < 5; k++) {
      ball(0.075, 0.075, 0.075, bloomMaterials[(k + n * 2) % 5], x - 0.34 + k * 0.17, 1.05 + (k % 2) * 0.03, 1.65);
    }
  });
  // A round porthole in the end wall.
  const portholeGlass = add(new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), cottageGlass), -2.12, 2.7, 0);
  portholeGlass.rotation.y = -Math.PI / 2;
  const portholeRing = add(new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 6, 16), cottageMat.trim), -2.1, 2.7, 0);
  portholeRing.rotation.y = Math.PI / 2;

  // A crooked chimney on the far end, with a pot and smoke drifting up from it.
  const chimney = new THREE.Group();
  chimney.position.set(1.85, 0.3, 0);
  chimney.rotation.z = -0.06;
  const chimneyBox = (w, h, d, material, y) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.y = y;
    chimney.add(mesh);
  };
  chimneyBox(0.65, 4.2, 0.75, cottageMat.stone, 2.1);
  chimneyBox(0.8, 0.16, 0.9, cottageMat.stone, 4.28);
  chimneyBox(0.3, 0.24, 0.3, cottageMat.wood, 4.46);
  group.add(chimney);
  for (let k = 0; k < 6; k++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), smokeMaterial.clone());
    group.add(puff);
    cottageSmoke.push(puff);
  }

  // The front garden: a white picket fence with a gate, stepping stones, tall flowers, shrubs,
  // toadstools, and a lantern by the gate.
  const FRONT = 3.1;
  const post = (x, z) => {
    add(new THREE.Mesh(picketPostGeometry, picketMaterial), x, 0.17, z);
    add(new THREE.Mesh(picketCapGeometry, picketMaterial), x, 0.375, z);
  };
  const run = (x1, z1, x2, z2) => {
    const steps = Math.max(2, Math.round(Math.hypot(x2 - x1, z2 - z1) / 0.22));
    for (let i = 0; i <= steps; i++) post(x1 + ((x2 - x1) * i) / steps, z1 + ((z2 - z1) * i) / steps);
    const rail = (y) => {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const mesh = box(Math.abs(x2 - x1) > Math.abs(z2 - z1) ? length : 0.04, 0.04, Math.abs(x2 - x1) > Math.abs(z2 - z1) ? 0.04 : length, cottageMat.trim, (x1 + x2) / 2, y, (z1 + z2) / 2);
      return mesh;
    };
    rail(0.12);
    rail(0.26);
  };
  run(-3.2, FRONT, -0.95, FRONT);
  run(0.35, FRONT, 3.2, FRONT);
  run(-3.2, FRONT, -3.2, 0.4);
  run(3.2, FRONT, 3.2, 0.4);
  for (const [x, z] of [[-0.95, FRONT], [0.35, FRONT]]) {
    box(0.1, 0.5, 0.1, cottageMat.wood, x, 0.25, z);
    ball(0.075, 0.075, 0.075, cottageMat.gold, x, 0.55, z);
  }
  [[-0.3, 2.35], [-0.12, 2.8], [-0.36, 3.25]].forEach(([x, z]) => {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.06, 7), cottageMat.stone), x, 0.04, z);
  });
  for (let k = 0; k < 10; k++) {
    const r = (n) => seeded(2300 + k * 9 + n);
    const x = k < 5 ? -2.7 + r(1) * 1.7 : 1.1 + r(1) * 1.7;
    const height = 0.55 + r(2) * 0.5;
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, height, 5), cottageMat.stem), x, height / 2 + 0.15, 1.95 + r(3) * 0.7);
    ball(0.09, 0.09, 0.09, bloomMaterials[k % 5], x, height + 0.17, group.children[group.children.length - 1].position.z);
  }
  for (let k = 0; k < 16; k++) {
    const r = (n) => seeded(2500 + k * 7 + n);
    ball(0.075, 0.075, 0.075, bloomMaterials[k % 5], -2.9 + r(1) * 5.8, 0.1 + r(2) * 0.05, 1.8 + r(3) * 1.15);
  }
  for (const [x, z, s] of [[-2.3, 1.85, 0.42], [1.7, 1.85, 0.38], [-2.95, 1.0, 0.36], [3.0, 1.1, 0.34]]) {
    ball(s, s * 0.85, s, cottageMat.leaf, x, s * 0.55, z);
    ball(s * 0.6, s * 0.5, s * 0.6, cottageMat.leafLight, x + s * 0.35, s * 0.95, z + s * 0.1);
  }
  for (const [x, z, s] of [[-2.0, 2.3, 1], [2.3, 2.5, 0.8], [-3.7, 2.0, 1.1], [3.8, 0.8, 0.9], [0.9, 3.9, 0.75]]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.17 * s, 6), cottageMat.trim), x, 0.085 * s, z);
    const cap = ball(0.19 * s, 0.14 * s, 0.19 * s, cottageMat.toadstool, x, 0.2 * s, z);
    for (let k = 0; k < 3; k++) {
      ball(0.035 * s, 0.025 * s, 0.035 * s, cottageMat.white, x + (k - 1) * 0.08 * s, 0.3 * s + (k === 1 ? 0.01 : 0), z + (k % 2 ? 0.05 : -0.05) * s);
    }
    void cap;
  }
  box(0.07, 1.0, 0.07, cottageMat.wood, 0.75, 0.5, FRONT + 0.05);
  const lantern = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), lanternGlass), 0.75, 1.13, FRONT + 0.05);
  void lantern;
  add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.14, 4), cottageMat.wood), 0.75, 1.33, FRONT + 0.05).rotation.y = Math.PI / 4;

  // A tree beside it, with a birdhouse on the trunk and a swing from a branch.
  const treeX = -3.9;
  const treeZ = -1.2;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 2.3, 7), cottageMat.wood), treeX, 1.15, treeZ);
  for (const [dx, dy, dz, rx, ry, material] of [[0, 3.1, 0, 1.55, 1.25, cottageMat.leaf], [0.9, 2.65, 0.4, 1.0, 0.85, cottageMat.leafLight], [-0.85, 2.7, -0.3, 1.05, 0.9, cottageMat.leaf], [0.1, 3.8, -0.1, 0.95, 0.8, cottageMat.leafLight]]) {
    ball(rx, ry, rx, material, treeX + dx, dy, treeZ + dz);
  }
  const branch = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 2.0, 6), cottageMat.wood), treeX, 2.15, treeZ + 0.95);
  branch.rotation.x = Math.PI / 2;
  const swing = new THREE.Group();
  swing.position.set(treeX, 2.12, treeZ + 1.55);
  for (const side of [-1, 1]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.5, 4), cottageMat.trim);
    rope.position.set(side * 0.24, -0.75, 0);
    swing.add(rope);
  }
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.06, 0.26), cottageMat.pink);
  seat.position.y = -1.5;
  swing.add(seat);
  group.add(swing);
  cottageSwing = swing;
  const birdhouse = box(0.24, 0.26, 0.24, cottageMat.mint, treeX + 0.25, 1.5, treeZ + 0.22);
  birdhouse.rotation.y = 0.8;
  add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.16, 4), cottageMat.pink), treeX + 0.25, 1.72, treeZ + 0.22).rotation.y = 0.8 + Math.PI / 4;

  // Faces the garden.
  group.position.set(COTTAGE_AT.x, GROUND_Y, COTTAGE_AT.z);
  group.rotation.y = Math.atan2(GARDEN_CENTRE.x - COTTAGE_AT.x, GARDEN_CENTRE.z - COTTAGE_AT.z);
  group.scale.setScalar(COTTAGE_SCALE);
  scene.add(group);
  group.updateMatrixWorld(true);
  cottageGroup = group;
}
buildCottage();

// Dirt lanes wind from the cottage gate to the gardens: one to the walkway between the
// Fruit and Vegetable Gardens, one round the side to the walkway by the Flower Garden. A
// lane is only a strip of ground colour with a few pebbles along its edges: figures still
// walk only on the flagstones, and nothing depends on where a lane goes.
const laneSamples = [];
const laneMaterial = new THREE.MeshStandardMaterial({ color: 0xa98d62, flatShading: true, side: THREE.DoubleSide });
laneMaterial.polygonOffset = true;
laneMaterial.polygonOffsetFactor = -2;
laneMaterial.polygonOffsetUnits = -2;

function buildLane(points, width, seed) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "catmullrom", 0.5);
  const steps = Math.ceil(curve.getLength() * 3);
  const positions = [];
  const indices = [];
  const edges = [];
  for (let i = 0; i <= steps; i++) {
    const p = curve.getPointAt(i / steps);
    const t = curve.getTangentAt(i / steps);
    const half = (width * (0.9 + 0.2 * Math.sin(i * 0.5 + seed))) / 2;
    const nx = -t.z;
    const nz = t.x;
    positions.push(p.x + nx * half, GROUND_Y + 0.022, p.z + nz * half, p.x - nx * half, GROUND_Y + 0.022, p.z - nz * half);
    if (i < steps) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    laneSamples.push({ x: p.x, z: p.z });
    if (i % 2 === 0) edges.push({ x: p.x, z: p.z, nx, nz, half, i });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Array(positions.length).fill(0).map((_, k) => (k % 3 === 1 ? 1 : 0)), 3));
  geometry.setIndex(indices);
  scene.add(new THREE.Mesh(geometry, laneMaterial));
  return edges;
}

{
  const gate = cottageGroup.localToWorld(new THREE.Vector3(-0.3, 0, 3.6));
  const bend = (from, to, t, push) => {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const length = Math.hypot(dx, dz);
    return [from[0] + dx * t - (dz / length) * push, from[1] + dz * t + (dx / length) * push];
  };
  const here = [gate.x, gate.z];
  const toWalkway = [6, -17.2];
  const laneA = [here, bend(here, toWalkway, 0.3, 1.3), bend(here, toWalkway, 0.62, -1.2), toWalkway, [6, -12.6]];
  const laneB = [bend(here, toWalkway, 0.14, 0.4), [here[0] + 5.4, here[1] + 0.6], [21.6, -17.4], [20.4, -11.6], [17.6, -7.4], [14.2, -6.1], [12.6, -6.0]];
  const edges = [...buildLane(laneA, 1.25, 0.4), ...buildLane(laneB, 1.1, 2.2)];
  const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), flatMaterial(0xffffff), edges.length * 2);
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  let n = 0;
  edges.forEach((edge, k) => {
    for (const side of [1, -1]) {
      const r = (m) => seeded(3100 + k * 11 + side * 5 + m);
      if (r(1) < 0.4) continue;
      const out = edge.half + 0.06 + r(2) * 0.18;
      dummy.position.set(edge.x + edge.nx * out * side, GROUND_Y + 0.03, edge.z + edge.nz * out * side);
      const size = 0.07 + r(3) * 0.11;
      dummy.scale.set(size, size * 0.55, size * 0.8);
      dummy.rotation.set(0, r(4) * 6.28, 0);
      dummy.updateMatrix();
      pebbles.setMatrixAt(n, dummy.matrix);
      pebbles.setColorAt(n++, tint.setRGB(0.55 + r(5) * 0.35, 0.53 + r(5) * 0.33, 0.48 + r(5) * 0.3));
    }
  });
  pebbles.count = n;
  pebbles.frustumCulled = false;
  pebbles.instanceMatrix.needsUpdate = true;
  pebbles.instanceColor.needsUpdate = true;
  scene.add(pebbles);
}

// A path from the gap in your own garden's hedge to the shared garden: a dirt strip with
// flagstones set in it, like the ones round the beds. It is only for show: figures still
// walk only on the beds' own paths, and nothing depends on where this one goes.
{
  const fromGap = [OWN_CENTRE.x, OWN_CENTRE.z + OWN_HEDGE - 0.3];
  const toBed = [-4.7, 1.3];
  const points = [fromGap, [OWN_CENTRE.x + 0.4, OWN_CENTRE.z + OWN_HEDGE + 1.9], [-12.4, 9.9], [-8.6, 7.6], [-6.0, 4.0], toBed];
  buildLane(points, 1.5, 3.1);
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "catmullrom", 0.5);
  const count = Math.ceil(curve.getLength() / 0.58);
  for (let i = 0; i <= count; i++) {
    const t = curve.getTangentAt(i / count);
    const p = curve.getPointAt(i / count);
    for (const side of [-1, 1]) {
      const n = 7000 + i * 7 + (side + 1) * 3;
      const off = side * (0.27 + (seeded(n + 1) - 0.5) * 0.14);
      const stone = new THREE.Mesh(
        flagstoneGeometries[Math.floor(seeded(n + 2) * flagstoneGeometries.length)],
        stoneMaterials[Math.floor(seeded(n + 3) * stoneMaterials.length)],
      );
      const size = 0.5 + seeded(n + 4) * 0.1;
      stone.scale.set(size, 1, size * (0.9 + seeded(n + 5) * 0.2));
      stone.rotation.y = seeded(n + 6) * Math.PI * 2;
      stone.position.set(p.x - t.z * off + (seeded(n + 7) - 0.5) * 0.1, GROUND_Y + 0.025 + seeded(n + 8) * 0.006, p.z + t.x * off + (seeded(n + 9) - 0.5) * 0.1);
      scene.add(stone);
    }
  }
}

// Low garden lights along both sides of the path to your own garden: a short iron stake with
// a small glass globe that glows after dark. Only a picture, like the path itself.
const gardenLightGlows = [];
{
  const pathPoints = [
    [OWN_CENTRE.x, OWN_CENTRE.z + OWN_HEDGE - 0.3],
    [OWN_CENTRE.x + 0.4, OWN_CENTRE.z + OWN_HEDGE + 1.9],
    [-12.4, 9.9],
    [-8.6, 7.6],
    [-6.0, 4.0],
    [-4.7, 1.3],
  ];
  const curve = new THREE.CatmullRomCurve3(pathPoints.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "catmullrom", 0.5);
  const iron = flatMaterial(0x1f3a32);
  const stakeGeometry = new THREE.CylinderGeometry(0.014, 0.022, 0.3, 6);
  const capGeometry = new THREE.ConeGeometry(0.075, 0.05, 6);
  const globeGeometry = new THREE.SphereGeometry(0.065, 8, 6);
  const count = Math.round(curve.getLength() / 1.7);
  for (let i = 1; i < count; i++) {
    const u = i / count;
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u);
    for (const side of [-1, 1]) {
      // The first light on the garden's side would stand on a stone of the ring round it.
      if (i === 1 && side === -1) continue;
      const light = new THREE.Group();
      // Just beyond the lane's edge, one on each side.
      const off = side * 1.02;
      light.position.set(p.x - t.z * off, GROUND_Y, p.z + t.x * off);
      const stake = new THREE.Mesh(stakeGeometry, iron);
      stake.position.y = 0.15;
      light.add(stake);
      const globeMaterial = new THREE.MeshStandardMaterial({ color: 0xfff0c4, emissive: 0xffc860, emissiveIntensity: 0.25, flatShading: true });
      const globe = new THREE.Mesh(globeGeometry, globeMaterial);
      globe.position.y = 0.34;
      light.add(globe);
      const cap = new THREE.Mesh(capGeometry, iron);
      cap.position.y = 0.43;
      light.add(cap);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(0.9);
      halo.position.y = 0.34;
      light.add(halo);
      scene.add(light);
      gardenLightGlows.push({ halo, globeMaterial });
    }
  }
}

function updateCottage(timeSeconds) {
  // Lamplight in the windows and the lantern from dusk until dawn.
  cottageGlass.color.copy(glassNight).lerp(glassDay, dayness);
  lanternGlass.color.copy(lanternNight).lerp(lanternDay, dayness);
  cottageSmoke.forEach((puff, k) => {
    const p = (timeSeconds / 9 + k / cottageSmoke.length) % 1;
    puff.position.set(1.85 + p * 1.5, 4.7 + p * 2.6, p * 0.5);
    puff.scale.setScalar(0.18 + p * 0.48);
    puff.material.opacity = 0.6 * Math.min(p / 0.12, 1) * (1 - p);
  });
  cottageSwing.rotation.x = Math.sin(timeSeconds * 0.9) * 0.14;
}

// Fireflies: small warm lights that drift over the lawns and blink slowly, out only
// at night (they follow the stars' fade, so they arrive at dusk and leave at dawn).
// They are only a picture: they sit nowhere in the scene's rules, can't be clicked,
// and the server knows nothing of them. Every browser draws its own, the same way.
const FIREFLY_COUNT = 70;
const fireflyUniforms = {
  time: { value: 0 },
  night: { value: 0 },
  pixelsPerUnit: { value: 600 },
};
const fireflies = (() => {
  const base = new Float32Array(FIREFLY_COUNT * 3);
  const seeds = new Float32Array(FIREFLY_COUNT);
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    // Most are over the shared garden's lawns and paths; a third gather round your own garden.
    const nearOwn = i % 3 === 0;
    const x = nearOwn ? OWN_CENTRE.x + (seeded(7100 + i) - 0.5) * 11 : -10 + seeded(7100 + i) * 34;
    const z = nearOwn ? OWN_CENTRE.z + (seeded(7200 + i) - 0.5) * 11 : -20 + seeded(7200 + i) * 30;
    base.set([x, 0.35 + seeded(7300 + i) * 1.7, z], i * 3);
    seeds[i] = seeded(7400 + i) * 100;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(base, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: fireflyUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float seed;
      uniform float time;
      uniform float night;
      uniform float pixelsPerUnit;
      varying float glow;
      void main() {
        vec3 p = position;
        // A wide, lazy wander, a quicker loop on top, and a small darting wobble.
        float speed = 0.8 + fract(seed * 0.37) * 0.5;
        p.x += sin(time * 0.6 * speed + seed) * 2.4 + sin(time * 1.5 * speed + seed * 2.0) * 0.6 + sin(time * 3.1 + seed * 4.0) * 0.12;
        p.y += sin(time * 0.9 * speed + seed * 1.7) * 0.6 + sin(time * 2.3 + seed * 3.0) * 0.12;
        p.z += cos(time * 0.5 * speed + seed * 1.3) * 2.4 + cos(time * 1.3 * speed + seed) * 0.6 + cos(time * 2.9 + seed * 5.0) * 0.12;
        // Each one swells and fades on its own slow beat, and is dark between.
        float beat = sin(time * (0.7 + fract(seed) * 0.6) + seed * 5.0);
        glow = night * smoothstep(-0.35, 0.8, beat);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = max(0.1, 0.16 * pixelsPerUnit / -mv.z) * (0.6 + 0.4 * glow);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float glow;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float core = smoothstep(1.0, 0.0, d);
        gl_FragColor = vec4(1.0, 0.92, 0.45, core * core * glow);
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);
  return points;
})();
const stillMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function updateFireflies(timeSeconds) {
  const night = stars.visible ? stars.material.opacity : 0;
  for (const { halo, globeMaterial } of gardenLightGlows) {
    halo.material.opacity = 0.75 * night;
    globeMaterial.emissiveIntensity = 0.25 + 0.9 * night;
  }
  for (const { group } of ownDecorBuilt.values()) {
    if (group.userData.halo) group.userData.halo.material.opacity = 0.9 * night;
  }
  fireflies.visible = night > 0.02;
  if (!fireflies.visible) return;
  fireflyUniforms.night.value = night;
  // With reduced motion they hold still and only glow softly.
  // The page's own clock, not the server's: the server's is about 1.7 billion seconds,
  // too big for the shader's floats to move in steps smaller than a couple of minutes.
  fireflyUniforms.time.value = stillMotion.matches ? 0 : performance.now() / 1000;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  fireflyUniforms.pixelsPerUnit.value = size.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
}

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
  updateFireflies(serverNow() / 1000);
  updateCows(serverNow() / 1000);
  updateHills();
  updateCottage(serverNow() / 1000);
  updateDrops(now);
  updateBadges(now);
  updateFigures(now);
  updateWaveRings(now);
  renderer.render(scene, camera);
  // A photo is taken straight after a frame is drawn, because the canvas is only
  // readable until the browser has shown it.
  if (photoRequested) takePhoto();
}
animate();
