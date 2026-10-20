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
  if (takes !== null) {
    const small = document.createElement("small");
    small.textContent = `Takes ${takes.map((type) => PLANT_NAME[type].toLowerCase()).join(" and ")}`;
    bedHere.append(small);
  }
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
    if (Array.isArray(hello.beds) && hello.beds.length === BEDS) beds = hello.beds;
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

// When the server last told this browser to slow down, until when to hold off.
let actionsPausedUntil = 0;
const SLOW_DOWN_MESSAGE = "Slow down: too many actions, try again in a few seconds";

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
  const radius = 21 + seeded(i * 3 + 1) * 5;
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
  updateCows(serverNow() / 1000);
  updateDrops(now);
  updateBadges(now);
  updateFigures(now);
  updateWaveRings(now);
  renderer.render(scene, camera);
}
animate();
