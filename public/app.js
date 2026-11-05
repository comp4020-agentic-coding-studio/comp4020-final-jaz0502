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
const CAMERA_TARGET = new THREE.Vector3(0, 1.5, 0);
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 160);
// From outside the square, looking across Bed 1 towards the other beds, so they
// show in the distance and can be hovered and clicked to go there.
camera.position.set(-6.5, 3.1, 6.5);
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

const SKY_DISC_MAX_RISE = 0.3; // about 17 degrees at midday, just clear of the far ridge (near 13)
const SKY_DISC_DISTANCE = 100; // past the furthest hills (76), inside the camera's far plane
function skyDisc(size, colour) {
  const disc = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: DISC_TEXTURE, color: colour, transparent: true, fog: false }),
  );
  disc.scale.set(size, size, 1);
  disc.userData.size = size;
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
  cloudColour.multiplyScalar(1 - 0.34 * weatherNow.cloud);
  for (const material of cloudMaterials) material.color.copy(cloudColour);

  for (const cloud of clouds) {
    const theta = cloud.theta0 + cloud.speed * timeSeconds;
    cloud.group.position.set(Math.cos(theta) * cloud.radius, cloud.height, Math.sin(theta) * cloud.radius);
    // The cloud's long axis lies along its path.
    cloud.group.rotation.y = -(theta + Math.PI / 2);
    // Under cloud they swell and sink until they run into one another.
    cloud.group.scale.setScalar(1 + 0.9 * weatherNow.cloud);
    cloud.group.position.y -= 1.2 * weatherNow.cloud;
  }
}

let dayness = 1;
// How dark the night is, from the sky's own timetable. Lamps and fireflies follow this, so
// they still glow on a rainy night even though cloud hides the stars.
let skyNight = 0;

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
  // Out past the hills and the far trees, on a higher arc than the ground one above, so at
  // midday it clears the ridge and as it sets it goes down behind the hills and the trees in
  // front of them, instead of being drawn on top of them.
  const away = mesh.position.clone().sub(camera.position).setY(0).normalize();
  const rise = Math.sin(angle) * SKY_DISC_MAX_RISE;
  mesh.position.set(
    camera.position.x + away.x * Math.cos(rise) * SKY_DISC_DISTANCE,
    camera.position.y + Math.sin(rise) * SKY_DISC_DISTANCE,
    camera.position.z + away.z * Math.cos(rise) * SKY_DISC_DISTANCE,
  );
  mesh.scale.setScalar(mesh.userData.size * (SKY_DISC_DISTANCE / 45));
}

function updateSky() {
  updateWeatherState();
  const phase = (((serverNow() % dayLengthMs) + dayLengthMs) % dayLengthMs) / dayLengthMs;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].at <= phase) i++;
  const from = SKY_KEYS[i];
  const to = SKY_KEYS[i + 1];
  const t = (phase - from.at) / (to.at - from.at);

  blendColour(skyColour, from.sky, to.sky, t);
  greyOut(skyColour, 0.72 * weatherNow.cloud);
  scene.fog.color.copy(skyColour);
  skyUniforms.horizonColour.value.copy(skyColour);
  blendColour(skyUniforms.midColour.value, from.mid, to.mid, t);
  blendColour(skyUniforms.topColour.value, from.top, to.top, t);
  greyOut(skyUniforms.midColour.value, 0.78 * weatherNow.cloud);
  greyOut(skyUniforms.topColour.value, 0.85 * weatherNow.cloud);
  skyUniforms.glow.value = (from.glow + (to.glow - from.glow) * t) * (1 - 0.85 * weatherNow.cloud);
  ambient.color.copy(blendColour(ambientColour, from.ambient, to.ambient, t));
  greyOut(ambient.color, 0.5 * weatherNow.cloud);
  ambient.intensity = (from.ambientI + (to.ambientI - from.ambientI) * t) * (1 - 0.12 * weatherNow.cloud);
  skyNight = from.stars + (to.stars - from.stars) * t;
  // Cloud hides the stars, but not the night: skyNight is what lamps follow.
  stars.material.opacity = skyNight * (1 - 0.92 * weatherNow.cloud);
  stars.visible = stars.material.opacity > 0.01;
  // The fog closes in under cloud and rain.
  scene.fog.near = 22 - 8 * weatherNow.cloud;
  scene.fog.far = 60 - 14 * weatherNow.cloud;

  // The sun is up from 0.25 to 0.75 and the moon the rest of the time.
  const sunAngle = ((phase - 0.25) / 0.5) * Math.PI;
  const moonAngle = ((((phase - 0.75) % 1) + 1) % 1 / 0.5) * Math.PI;
  // 0 at night, easing up to 1 once the sun is well above the horizon: the
  // insects come out with it and leave as it sets.
  dayness = phase >= 0.25 && phase < 0.75 ? Math.min(Math.max(Math.sin(sunAngle) / 0.35, 0), 1) : 0;
  placeOnArc(sunDisc, sunAngle);
  placeOnArc(moonDisc, moonAngle);
  // Cloud covers the sun and the moon.
  for (const disc of [sunDisc, moonDisc]) {
    disc.material.opacity *= 1 - 0.92 * weatherNow.cloud;
    disc.visible = disc.material.opacity > 0.01;
  }
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
  skyLight.intensity = (from.lightI + (to.lightI - from.lightI) * t) * Math.min(Math.max(height / 0.3, 0), 1) * (1 - 0.55 * weatherNow.cloud);
  updateSeasonState();
  // Rain darkens the lawn; a winter lawn is under snow, which rain does not darken.
  const wet = 1 - 0.24 * weatherNow.rainAmt * (1 - seasonNow.snow);
  ground.material.color.copy(seasonNow.lawn).multiplyScalar(wet);
  ground.material.emissive.setScalar(0.5 * seasonNow.snow * (0.3 + 0.7 * dayness));
}

// Weather: clear, overcast or rain, drifting from one to the next every half a day. Like
// the clouds and the cows it is a pure function of the server's clock, so everyone sees the
// same sky at the same moment, and it is only a picture: nothing is sent, stored or logged,
// and it never waters a plant or changes a plot, so it limits nothing and depends on nothing.
const WEATHER_KINDS = [
  { cloud: 0, rain: 0 }, // clear
  { cloud: 0.65, rain: 0 }, // overcast
  { cloud: 1, rain: 1 }, // rain
];
const weatherNow = { cloud: 0, rain: 0, rainAmt: 0 };
const weatherGrey = new THREE.Color();

function weatherKind(period) {
  const r = seeded(period * 13.7 + 5);
  return r < 0.5 ? 0 : r < 0.75 ? 1 : 2;
}

// What the weather is at a moment, in the units of the clouds and the rain. The first fifth
// of each period is the change from the one before, so it comes and goes gradually.
function weatherAt(ms) {
  const period = dayLengthMs / 2;
  const index = Math.floor(ms / period);
  const into = (ms - index * period) / period;
  const k = smooth(clamp01(into / 0.2));
  const from = WEATHER_KINDS[weatherKind(index - 1)];
  const to = WEATHER_KINDS[weatherKind(index)];
  return { cloud: from.cloud + (to.cloud - from.cloud) * k, rain: from.rain + (to.rain - from.rain) * k };
}

function updateWeatherState() {
  const w = weatherAt(serverNow());
  weatherNow.cloud = w.cloud;
  weatherNow.rain = w.rain;
  // Rain only shows once the sky has clouded over, and then thickens.
  weatherNow.rainAmt = clamp01((w.rain - 0.35) / 0.65);
}

// The colour mixed toward its own grey: the same brightness with the colour taken out.
function greyOut(colour, amount) {
  const lum = colour.r * 0.2126 + colour.g * 0.7152 + colour.b * 0.0722;
  weatherGrey.setScalar(lum * 0.85);
  colour.lerp(weatherGrey, amount);
}

// Rain: a few thousand thin streaks in a box that follows the camera. Each one falls on the
// graphics card and wraps round the camera, so the rain stays put in the world as you look
// about, and thins out toward the edge. Streaks come in with the rain's strength.
const RAIN_DROPS = 3200;
const rainUniforms = {
  time: { value: 0 },
  amount: { value: 0 },
  centre: { value: new THREE.Vector3() },
  colour: { value: new THREE.Color(0xbfd2e0) },
  floorY: { value: GROUND_Y },
};
const rain = (() => {
  const base = new Float32Array(RAIN_DROPS * 2 * 3);
  const end = new Float32Array(RAIN_DROPS * 2);
  const rand = new Float32Array(RAIN_DROPS * 2);
  for (let i = 0; i < RAIN_DROPS; i++) {
    const x = seeded(8100 + i) * 40;
    const y = seeded(8200 + i) * 14;
    const z = seeded(8300 + i) * 40;
    const r = seeded(8400 + i);
    for (let k = 0; k < 2; k++) {
      base.set([x, y, z], (i * 2 + k) * 3);
      end[i * 2 + k] = k;
      rand[i * 2 + k] = r;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(base, 3));
  geometry.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: rainUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float aEnd;
      attribute float aRand;
      uniform float time;
      uniform float amount;
      uniform vec3 centre;
      uniform float floorY;
      varying float vAlpha;
      void main() {
        float height = 14.0;
        float speed = 13.0 + aRand * 6.0;
        float y = mod(position.y - time * speed, height);
        vec2 rel = mod(position.xz - centre.xz + 20.0, 40.0) - 20.0;
        // Slanted: it drifts sideways as it falls, and the streak leans back along its path.
        float lean = 0.16;
        vec3 p = vec3(centre.x + rel.x + lean * (height - y), floorY + y, centre.z + rel.y);
        p += aEnd * vec3(-lean, 1.0, 0.0) * 0.55;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float shown = step(fract(aRand * 7.31), amount);
        float edge = 1.0 - smoothstep(11.0, 20.0, length(rel));
        float ends = smoothstep(0.0, 1.2, y) * (1.0 - smoothstep(height - 1.5, height, y));
        float nearLens = smoothstep(1.0, 3.0, -mv.z);
        vAlpha = shown * edge * ends * nearLens * 0.75;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 colour;
      varying float vAlpha;
      void main() {
        gl_FragColor = vec4(colour, vAlpha);
      }`,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);
  return lines;
})();

function updateRain() {
  // With reduced motion the sky still darkens, but no streaks are drawn.
  const shown = weatherNow.rainAmt * (1 - seasonNow.snow) > 0.02 && !stillMotion.matches;
  rain.visible = shown;
  if (!shown) return;
  rainUniforms.amount.value = weatherNow.rainAmt * (1 - seasonNow.snow);
  rainUniforms.time.value = performance.now() / 1000;
  rainUniforms.centre.value.copy(camera.position);
  // The drops are as bright as the clouds are: pale by day, dim at night.
  rainUniforms.colour.value.copy(cloudColour);
}

// Seasons: spring, summer, autumn and winter, each two garden days long and then the next.
// Like the weather and the cows it is a pure function of the server's clock, so everyone
// sees the same season at the same moment. It only changes colours and what falls from the
// sky: the lawn, the hills and the leaves of the far trees, leaves in autumn, snow in
// winter. Nothing is sent, stored or logged, and a plant, a plot and every action are the
// same in every season.
const SEASON_DAYS = 2;
const SEASONS = [
  // lawn multiplies the grass texture; leaf multiplies the far broadleaf trees; hill the hills
  { lawn: [0.82, 1.3, 0.95], leaf: [0.85, 1.3, 0.9], hill: [0.85, 1.2, 0.95], fall: 0, petal: 1, snow: 0 }, // spring
  { lawn: [1.12, 0.92, 0.62], leaf: [0.9, 0.85, 0.7], hill: [1.1, 0.95, 0.7], fall: 0, petal: 0, snow: 0 }, // summer
  { lawn: [1.75, 1.0, 0.5], leaf: [3.0, 1.0, 0.3], hill: [1.9, 0.95, 0.5], fall: 1, petal: 0, snow: 0 }, // autumn
  { lawn: [2.6, 2.7, 3.0], leaf: [1.15, 1.1, 1.05], hill: [1.5, 1.6, 1.8], fall: 0, petal: 0, snow: 1 }, // winter
];
const seasonNow = { lawn: new THREE.Color(), leaf: new THREE.Color(), hill: new THREE.Color(), fall: 0, petal: 0, snow: 0, index: 0 };

function seasonAt(ms) {
  const length = dayLengthMs * SEASON_DAYS;
  const s = (((ms / length) % 4) + 4) % 4;
  const index = Math.floor(s);
  // The last third of a season is the change to the next one.
  const k = smooth(clamp01((s - index - 0.67) / 0.33));
  return { index, k, from: SEASONS[index], to: SEASONS[(index + 1) % 4] };
}

function updateSeasonState() {
  const pinned = window.__season;
  const { index, k, from, to } = pinned !== undefined ? { index: Math.floor(pinned), k: 0, from: SEASONS[Math.floor(pinned) % 4], to: SEASONS[Math.floor(pinned) % 4] } : seasonAt(serverNow());
  const mix = (a, b) => a + (b - a) * k;
  for (const key of ["lawn", "leaf", "hill"]) seasonNow[key].setRGB(mix(from[key][0], to[key][0]), mix(from[key][1], to[key][1]), mix(from[key][2], to[key][2]));
  seasonNow.fall = mix(from.fall, to.fall);
  seasonNow.petal = mix(from.petal, to.petal);
  seasonNow.snow = mix(from.snow, to.snow);
  seasonNow.index = index;
}

// What falls: autumn leaves, and snow in winter (a light fall even when it is clear, heavier
// under cloud). Points in a box that follows the camera, wrapped on the graphics card like
// the rain. With reduced motion nothing falls.
const FALL_COUNT = 1560; // leaves and petals show a third of these, snow shows them all
const fallUniforms = {
  time: { value: 0 },
  centre: { value: new THREE.Vector3() },
  leaves: { value: 0 },
  snow: { value: 0 },
  petals: { value: 0 },
  floorY: { value: GROUND_Y },
  scale: { value: 300 },
  shapes: { value: null },
};
// The shapes that fall, drawn once: an autumn leaf with a stalk and veins on the left, a
// curled blossom petal on the right. They are white and grey, and the colour is put on by
// the shader, so one picture serves every colour of leaf.
function fallShapes() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  // Leaf: a pointed oval with a slightly lobed edge, a stalk and a midrib with side veins.
  ctx.save();
  ctx.translate(32, 32);
  ctx.rotate(-Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.bezierCurveTo(-18, -17, -4, -22, 4, -16);
  ctx.bezierCurveTo(12, -20, 20, -10, 27, 0);
  ctx.bezierCurveTo(20, 10, 12, 20, 4, 16);
  ctx.bezierCurveTo(-4, 22, -18, 17, -26, 0);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(90,90,90,0.75)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.lineTo(24, 0);
  for (const x of [-16, -6, 4, 14]) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 7, -8);
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 7, 8);
  }
  ctx.stroke();
  ctx.restore();
  // Petal: a rounded teardrop with a notch at the tip and a pale line down its middle.
  ctx.save();
  ctx.translate(96, 32);
  ctx.rotate(-Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.bezierCurveTo(-14, -15, 8, -20, 20, -6);
  ctx.lineTo(24, -1);
  ctx.lineTo(20, 4);
  ctx.bezierCurveTo(8, 20, -14, 15, -22, 0);
  ctx.closePath();
  const fill = ctx.createLinearGradient(-22, 0, 24, 0);
  fill.addColorStop(0, "#d8d8d8");
  fill.addColorStop(1, "#ffffff");
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = "rgba(150,150,150,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-20, 0);
  ctx.lineTo(16, 0);
  ctx.stroke();
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
fallUniforms.shapes.value = fallShapes();

const fall = (() => {
  const base = new Float32Array(FALL_COUNT * 3);
  const rand = new Float32Array(FALL_COUNT);
  for (let i = 0; i < FALL_COUNT; i++) {
    base.set([seeded(9100 + i) * 40, seeded(9200 + i) * 14, seeded(9300 + i) * 40], i * 3);
    rand[i] = seeded(9400 + i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(base, 3));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: fallUniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      attribute float aRand;
      uniform float time;
      uniform vec3 centre;
      uniform float leaves;
      uniform float snow;
      uniform float petals;
      uniform float floorY;
      uniform float scale;
      varying float vAlpha;
      varying vec3 vColour;
      varying float vSnow;
      varying float vPetal;
      varying float vSpin;
      varying float vFlip;
      void main() {
        float height = 14.0;
        // Each flake, petal or leaf is one kind, in the share the seasons are blending.
        float total = max(leaves + petals + snow, 0.001);
        float isSnow = step(fract(aRand * 3.91), snow / total);
        float isPetal = (1.0 - isSnow) * step(fract(aRand * 7.7), petals / max(leaves + petals, 0.001));
        float speed = mix(0.9 + aRand * 0.7, 1.1 + aRand * 1.2, isSnow) * mix(1.0, 0.7, isPetal);
        float y = mod(position.y - time * speed, height);
        vec2 rel = mod(position.xz - centre.xz + 20.0, 40.0) - 20.0;
        float sway = sin(time * (0.7 + aRand) + aRand * 40.0) * mix(1.1, 0.5, isSnow);
        vec3 p = vec3(centre.x + rel.x + sway, floorY + y, centre.z + rel.y + cos(time * 0.6 + aRand * 31.0) * 0.8);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float amount = max(max(leaves, petals), snow);
        float shown = step(fract(aRand * 5.17), amount * mix(0.34, 1.0, isSnow));
        float edge = 1.0 - smoothstep(11.0, 20.0, length(rel));
        float ends = smoothstep(0.0, 0.5, y) * (1.0 - smoothstep(height - 1.5, height, y));
        vAlpha = shown * edge * ends * smoothstep(2.5, 7.0, -mv.z);
        vSnow = isSnow;
        vPetal = isPetal;
        // Each one turns as it falls, and tips over now and then, like a real leaf.
        vSpin = aRand * 6.2832 + time * (0.6 + aRand * 1.6) * (aRand > 0.5 ? 1.0 : -1.0);
        vFlip = 0.35 + 0.65 * abs(cos(time * (0.9 + aRand * 1.4) + aRand * 20.0));
        float h = fract(aRand * 13.7);
        vec3 leafColour = h < 0.4 ? vec3(0.86, 0.38, 0.12) : h < 0.75 ? vec3(0.78, 0.2, 0.1) : vec3(0.92, 0.7, 0.18);
        vec3 petalColour = h < 0.5 ? vec3(1.0, 0.76, 0.84) : vec3(1.0, 0.9, 0.93);
        vColour = mix(mix(leafColour, petalColour, isPetal), vec3(0.97, 0.98, 1.0), isSnow);
        gl_PointSize = min(mix(mix(0.42, 0.26, isPetal), 0.13, isSnow) * scale / max(-mv.z, 0.5), 60.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D shapes;
      varying float vAlpha;
      varying vec3 vColour;
      varying float vSnow;
      varying float vPetal;
      varying float vSpin;
      varying float vFlip;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float soft = 1.0 - smoothstep(0.18, 0.5, length(d));
        // Turn the picture, and squash it across one way so it seems to tumble.
        float s = sin(vSpin);
        float k = cos(vSpin);
        vec2 r = vec2(k * d.x + s * d.y, -s * d.x + k * d.y);
        r.x /= vFlip;
        vec2 uv = r + 0.5;
        float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
        vec4 tex = texture2D(shapes, vec2(uv.x * 0.5 + 0.5 * vPetal, uv.y));
        vec3 shade = mix(tex.rgb, vec3(1.0), vSnow);
        float a = mix(tex.a * inside, soft, vSnow) * vAlpha;
        if (a < 0.02) discard;
        gl_FragColor = vec4(vColour * shade, a);
      }`,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);
  return points;
})();

function updateFall() {
  // Nothing falls in summer: leaves and petals begin once their season is half-way in.
  const leaves = Math.max(0, seasonNow.fall * 2 - 1) * 0.7;
  // A light snowfall in a clear winter, heavy when it is overcast or raining.
  const snow = seasonNow.snow * (0.3 + 0.7 * Math.max(weatherNow.rainAmt, weatherNow.cloud * 0.5));
  const petals = Math.max(0, seasonNow.petal * 2 - 1) * 0.6;
  const shown = (leaves > 0.02 || snow > 0.02 || petals > 0.02) && !stillMotion.matches;
  fall.visible = shown;
  if (!shown) return;
  fallUniforms.leaves.value = leaves;
  fallUniforms.snow.value = snow > 0.02 ? snow : 0;
  fallUniforms.petals.value = petals > 0.02 ? petals : 0;
  fallUniforms.time.value = performance.now() / 1000;
  fallUniforms.centre.value.copy(camera.position);
  fallUniforms.scale.value = renderer.domElement.height * 0.5;
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
    // Share the colour object, so the snow that whitens the earth whitens the strips too.
    mesh.material.color = material.color;
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
// The flat stones round your garden and in the path to it, where a pet can stand on one:
// { x, z, r, top }, so it is lifted onto a stone instead of sinking into it.
const petStones = [];
function addPetStone(mesh) {
  mesh.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(mesh);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  petStones.push({ x: centre.x, z: centre.z, r: (size.x + size.z) * 0.25 + 0.04, top: box.max.y });
}
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
    addPetStone(stone);
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
  // They come out with the sun and shelter from the rain.
  const size = dayness * dayness * (3 - 2 * dayness) * (1 - clamp01(weatherNow.rainAmt * 2));

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
const ownSign = document.getElementById("own-sign");
const ownButtons = [ownSign];

// The button that takes you to your garden takes you back to the shared one while you
// are there, and says so.
const OWN_LABELS = {
  to: "Visit your own garden, which only you can see",
  back: "Go back to the shared garden",
};
function renderOwnButtons() {
  for (const button of ownButtons) {
    button.setAttribute("aria-label", ownMode ? OWN_LABELS.back : OWN_LABELS.to);
    // The sign over your garden only shows while you are looking at the shared one.
    const label = button === ownSign ? null : button.querySelector("span");
    if (label) label.textContent = ownMode ? "Shared garden" : "My garden";
  }
}

function glideTo(toTarget, toCamera) {
  glide = { start: performance.now(), fromTarget: controls.target.clone(), toTarget, fromCamera: camera.position.clone(), toCamera };
}

function openOwnGarden() {
  if (ownMode || photoMode || interiorMode || interiorBusy) return;
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
  const overPet = petUnderPointer();
  const petFirst = overPet && (!hit || overPet.distance < hit.distance);
  const position = hit && !petFirst ? hit.object.userData.ownPosition : null;
  if (petFirst) {
    clearOwnHover();
    hoveredOwn = null;
    renderer.domElement.style.cursor = "pointer";
    return;
  }
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
  // Your pet in front of whatever is behind it gets a stroke, and nothing else happens.
  const pet = petUnderPointer();
  if (pet && (!hit || pet.distance < hit.distance)) {
    strokePet();
    return;
  }
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
const ownDecor = { unlocked: [], next: null, placed: {} };
let decorationList = [];
const decorBox = document.getElementById("own-decor");
const decorPicker = document.getElementById("decor-picker");
const decorNext = document.getElementById("decor-next");

// What is left of the task you are on, said as a plain thing to do. Only how many more, never
// how many in all, so it is a hint and not a target.
const TASK_TEXT = {
  water: (n) => `water ${n} more plant${n === 1 ? "" : "s"} in the shared garden`,
  "feed-cow": (n) => `feed ${n} more cow${n === 1 ? "" : "s"}`,
  "pat-hen": (n) => `pat ${n} more hen${n === 1 ? "" : "s"}`,
  plant: (n) => `plant ${n} more seed${n === 1 ? "" : "s"} in the shared garden`,
  gather: (n) => `gather seeds from ${n} more fully grown plant${n === 1 ? "" : "s"}`,
  compost: (n) => `compost ${n} more wilted plant${n === 1 ? "" : "s"}`,
};
function taskText(kind, left) {
  return (TASK_TEXT[kind] ?? (() => "keep looking after the garden"))(left);
}

function refreshDecorJournal() {
  const next = ownDecor.next;
  decorNext.hidden = next === null;
  decorNext.textContent = next === null ? "" : `Next decoration: ${taskText(next.do, next.left)}`;

  const unlocked = ownDecor.unlocked.map((id) => decorationList.find((d) => d.id === id)).filter(Boolean);
  // The fences come first, in a row of their own, then the props, each in the order they
  // were unlocked. The hedge your bed starts with is not something you unlock: it is what
  // shows when no fence is out. Once you have a fence it is offered too, at the front, so
  // you can go back to it.
  const fences = unlocked.filter((d) => d.kind === "fence");
  const props = unlocked.filter((d) => d.kind !== "fence");
  const have = [...(fences.length > 0 ? [{ id: "hedge", name: "Shrub hedge", kind: "fence" }] : []), ...fences, ...props];
  decorBox.hidden = false;
  decorBox.classList.toggle("locked", have.length === 0);
  document.getElementById("decor-locked").hidden = have.length > 0;
  decorPicker.hidden = have.length === 0;
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
  // Say so, in the middle of the screen, whenever a new decoration has unlocked. What this
  // browser has already been told about is kept in this browser only.
  const told = decorTold();
  if (told !== null && state.unlocked.length > told) {
    const newest = decorationList.find((d) => d.id === state.unlocked[state.unlocked.length - 1]);
    if (newest) {
      pushToast("decoration", `You've unlocked the ${newest.name}!`, `Find it in your journal ${toastWhere()}, under Decorations, while you are in My garden.`);
    }
  }
  rememberDecorTold(state.unlocked.length);
  ownDecor.unlocked = state.unlocked;
  ownDecor.next = state.next;
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
    if (Array.isArray(hello.pets)) petKinds = hello.pets;
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
  source.addEventListener("pet", (event) => renderPet(JSON.parse(event.data)));
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

// The cow the pointer is over, with how far away it is, using the ray already set up.
function cowUnderPointer() {
  const hit = raycaster.intersectObjects(cows.map((c) => c.group), true)[0];
  if (!hit) return null;
  const cow = cows.find((c) => {
    for (let o = hit.object; o; o = o.parent) if (o === c.group) return true;
    return false;
  });
  return cow ? { cow, distance: hit.distance } : null;
}

// The hen the pointer is over, with how far away it is, using the ray already set up. A hen
// is small, so it is a generous ball round her rather than her exact shape.
const HEN_REACH = 0.32;
function henUnderPointer() {
  let best = null;
  const point = new THREE.Vector3();
  const centre = new THREE.Vector3();
  for (const hen of hens) {
    centre.set(hen.group.position.x, GROUND_Y + 0.25, hen.group.position.z);
    if (!raycaster.ray.intersectSphere(new THREE.Sphere(centre, HEN_REACH), point)) continue;
    const distance = point.distanceTo(raycaster.ray.origin);
    if (!best || distance < best.distance) best = { hen, distance };
  }
  return best;
}

// When the server last told this browser to slow down, until when to hold off.
let actionsPausedUntil = 0;
const SLOW_DOWN_MESSAGE = "Slow down: too many actions, try again in a few seconds";

async function handlePointerClick(event) {
  if (photoMode) return; // the camera only looks: nothing in the garden is touched
  if (interiorMode) return interiorClick(event);
  closePlotChoice();
  if (ownMode) return ownClick(event);
  closeBag();
  raycaster.setFromCamera(ndcFromEvent(event), camera);
  const hit = raycaster.intersectObjects(soilMeshes, false)[0];
  // A cow in front of whatever is behind it gets some hay, and nothing else happens.
  const cow = cowUnderPointer();
  const hen = henUnderPointer();
  // A hen in front of everything else gets a stroke, and nothing else happens.
  if (hen && (!hit || hen.distance < hit.distance) && (!cow || hen.distance < cow.distance)) {
    petHen(hen.hen);
    return;
  }
  // The barn, in front of everything else, takes you inside.
  const barn = barnUnderPointer();
  if (barn && (!hit || barn.distance < hit.distance) && (!cow || barn.distance < cow.distance) && (!hen || barn.distance < hen.distance)) {
    enterBarn();
    return;
  }
  const cottage = cottageUnderPointer();
  if (cottage && (!hit || cottage.distance < hit.distance) && (!cow || cottage.distance < cow.distance) && (!hen || cottage.distance < hen.distance) && (!barn || cottage.distance < barn.distance)) {
    enterCottage();
    return;
  }
  if (cow && (!hit || cow.distance < hit.distance)) {
    feedCow(cow.cow);
    return;
  }
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

// The sign over your own garden follows it on screen, as the bed signs do, and shows
// whenever the garden is in view and you are not in it.
const ownSignPoint = new THREE.Vector3();
function updateOwnSign() {
  const rect = renderer.domElement.getBoundingClientRect();
  ownSignPoint.set(OWN_CENTRE.x, BED_SIGN_HEIGHT, OWN_CENTRE.z).project(camera);
  const x = rect.left + ((ownSignPoint.x + 1) / 2) * rect.width;
  const y = rect.top + ((1 - ownSignPoint.y) / 2) * rect.height;
  const visible = !ownMode && !glide && ownSignPoint.z < 1 && x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
  if (ownSign.hidden === visible) ownSign.hidden = !visible;
  if (!visible) return;
  ownSign.style.left = `${x}px`;
  ownSign.style.top = `${y}px`;
}

function clearHoveredPlot() {
  if (hoveredPosition !== null) sceneObjects.get(hoveredPosition).soilMesh.scale.set(1, 1, 1);
  hoveredPosition = null;
}

renderer.domElement.addEventListener("pointermove", (event) => {
  if (photoMode) return;
  if (interiorMode) return interiorPointerMove(event);
  if (ownMode) return ownPointerMove(event);
  raycaster.setFromCamera(ndcFromEvent(event), camera);
  const hit = raycaster.intersectObjects(soilMeshes, false)[0];
  let position = hit ? hit.object.userData.position : null;
  // A cow can be given hay, so the pointer says so over one.
  const overCow = cowUnderPointer();
  const overHen = henUnderPointer();
  const overBarn = barnUnderPointer() ?? cottageUnderPointer();
  renderer.domElement.style.cursor =
    (overCow && (!hit || overCow.distance < hit.distance)) || (overHen && (!hit || overHen.distance < hit.distance)) || (overBarn && (!hit || overBarn.distance < hit.distance)) ? "pointer" : "";

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
  // The last cow's patch is pushed out a little further, to keep clear of the cottage, and
  // the fourth's further still, to keep clear of the barn.
  const radius = 21 + seeded(i * 3 + 1) * 5 + (i === 4 ? 2 : 0) + (i === 3 ? 7 : 0);
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
    // A cow that has been given hay leaves its usual round for a little while.
    if (cow.feed) updateFeeding(cow, i);
  });
}

// Feeding a cow: click one and some hay lands in front of it, it walks over, eats with
// a few hearts floating up, then wanders back to where its day had put it. This is a
// way of looking and nothing more, like the camera: it is only in your own page, sends
// nothing to the server, is never stored or counted, and no cow is ever in anyone's
// way. Someone else's cow keeps to its usual round on their screen.
const FEED_WALK_S = 2.4;
const FEED_EAT_S = 6;
const FEED_RETURN_S = 3;
const lerpAngle = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

// Hay: a round bale lying on its side, a mound of loose straw heaped against it and a
// few stalks sticking out, in the same flat-shaded lumps as everything else, so it reads
// as a pile of hay and not a bundle of sticks or a crate.
const hayMaterial = flatMaterial(0xe0bb52);
const hayDarkMaterial = flatMaterial(0xc29a3c);
const hayLightMaterial = flatMaterial(0xf0d680);
const twineMaterial = flatMaterial(0x8a6a38);
const baleGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.55, 9, 1);
const baleRingGeometry = new THREE.CylinderGeometry(0.352, 0.352, 0.03, 9, 1);
const baleEndGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.01, 9, 1);
const tuftGeometry = new THREE.IcosahedronGeometry(1, 1);
const stalkGeometry = new THREE.CylinderGeometry(0.006, 0.014, 0.3, 4);
function buildHay() {
  const hay = new THREE.Group();
  // The bale: a cylinder on its side with a darker coil on each end and two bands of twine.
  const bale = new THREE.Group();
  const body = new THREE.Mesh(baleGeometry, hayMaterial);
  body.rotation.z = Math.PI / 2;
  bale.add(body);
  for (const dx of [-0.27, 0.27]) {
    const end = new THREE.Mesh(baleEndGeometry, hayDarkMaterial);
    end.rotation.z = Math.PI / 2;
    end.position.x = dx + Math.sign(dx) * 0.0;
    end.position.x = Math.sign(dx) * 0.2755;
    bale.add(end);
  }
  for (const dx of [-0.14, 0.14]) {
    const ring = new THREE.Mesh(baleRingGeometry, twineMaterial);
    ring.rotation.z = Math.PI / 2;
    ring.position.x = dx;
    bale.add(ring);
  }
  bale.position.set(-0.08, 0.34, -0.12);
  bale.rotation.y = 0.35;
  hay.add(bale);
  // A mound of loose straw in front: squashed lumps in three yellows, heaped up in the middle.
  const mound = [
    [0.0, 0.0, 0.5, 0.2, hayMaterial], [0.32, 0.12, 0.34, 0.16, hayLightMaterial], [-0.3, 0.2, 0.34, 0.15, hayDarkMaterial],
    [0.12, 0.34, 0.3, 0.14, hayDarkMaterial], [-0.1, 0.1, 0.28, 0.2, hayLightMaterial], [0.4, -0.12, 0.22, 0.12, hayMaterial],
    [-0.42, -0.02, 0.22, 0.11, hayLightMaterial], [0.05, 0.5, 0.2, 0.1, hayMaterial],
  ];
  mound.forEach(([x, z, r, h, material], k) => {
    const lump = new THREE.Mesh(tuftGeometry, material);
    lump.scale.set(r, h, r * 0.85);
    lump.position.set(x, h * 0.45, z + 0.35);
    lump.rotation.y = seeded(k + 70) * Math.PI;
    hay.add(lump);
  });
  // Stalks poking out of the mound and the bale, at all angles.
  for (let k = 0; k < 26; k++) {
    const stalk = new THREE.Mesh(stalkGeometry, k % 3 === 0 ? hayLightMaterial : hayMaterial);
    const a = seeded(k * 5 + 1) * Math.PI * 2;
    const r = seeded(k * 5 + 2) * 0.55;
    stalk.position.set(Math.cos(a) * r, 0.12 + seeded(k * 5 + 3) * 0.2, Math.sin(a) * r + 0.3);
    stalk.rotation.set((seeded(k * 5 + 4) - 0.5) * 2.2, seeded(k * 5 + 5) * Math.PI, (seeded(k * 5 + 6) - 0.5) * 2.2);
    hay.add(stalk);
  }
  return hay;
}

let heartTexture = null;
function getHeartTexture() {
  if (heartTexture) return heartTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#e0566e";
  ctx.beginPath();
  ctx.moveTo(32, 56);
  ctx.bezierCurveTo(4, 36, 8, 8, 32, 20);
  ctx.bezierCurveTo(56, 8, 60, 36, 32, 56);
  ctx.fill();
  heartTexture = new THREE.CanvasTexture(canvas);
  return heartTexture;
}

// The server only hears that you fed a cow or stroked a hen, to count it towards your next
// decoration. The animals are drawn here either way, so a refusal or a slow reply changes
// nothing you see.
function tellAnimal(kind, index) {
  if (index < 0 || Date.now() < actionsPausedUntil) return;
  fetch(`/api/animals/${kind}/${index}`, { method: "POST" })
    .then((res) => {
      if (res.status !== 429) return;
      const seconds = Number(res.headers.get("retry-after"));
      actionsPausedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 5) * 1000;
    })
    .catch(() => {});
}

function feedCow(cow) {
  if (cow.feed) return; // already eating: a second click does nothing
  tellAnimal("cow", cows.indexOf(cow));
  const from = { x: cow.group.position.x, z: cow.group.position.z, r: cow.group.rotation.y };
  // The hay lands a couple of steps in front of the cow, on the side the camera looks from.
  const toCamera = new THREE.Vector2(camera.position.x - from.x, camera.position.z - from.z).normalize();
  const hay = { x: from.x + toCamera.x * 2.4, z: from.z + toCamera.y * 2.4 };
  const stand = { x: hay.x - toCamera.x * 1.15, z: hay.z - toCamera.y * 1.15 };
  const mesh = buildHay();
  mesh.position.set(hay.x, GROUND_Y, hay.z);
  scene.add(mesh);
  const hearts = [0, 1, 2].map(() => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getHeartTexture(), transparent: true, depthWrite: false }));
    sprite.scale.set(0.45, 0.45, 1);
    sprite.visible = false;
    scene.add(sprite);
    return sprite;
  });
  cow.feed = {
    start: performance.now() / 1000,
    from,
    stand,
    heading: Math.atan2(-(hay.z - from.z), hay.x - from.x),
    mesh,
    hearts,
  };
  showStatusMessage("You tossed the cow some hay");
}

function endFeeding(cow) {
  scene.remove(cow.feed.mesh);
  for (const heart of cow.feed.hearts) {
    scene.remove(heart);
    heart.material.dispose();
  }
  cow.feed = null;
}

function updateFeeding(cow, index) {
  const f = cow.feed;
  const now = performance.now() / 1000;
  const t = now - f.start;
  const eatEnd = FEED_WALK_S + FEED_EAT_S;
  if (t >= eatEnd + FEED_RETURN_S) {
    endFeeding(cow);
    return;
  }
  // Where the cow's own round has it right now: it is what it walks back to.
  const usual = { x: cow.group.position.x, z: cow.group.position.z, r: cow.group.rotation.y };
  let x;
  let z;
  let rotation;
  let walking = 0;
  let lower = 0;
  if (t < FEED_WALK_S) {
    const k = smooth(t / FEED_WALK_S);
    x = f.from.x + (f.stand.x - f.from.x) * k;
    z = f.from.z + (f.stand.z - f.from.z) * k;
    rotation = lerpAngle(f.from.r, f.heading, smooth(clamp01(t / 0.5)));
    walking = 1;
  } else if (t < eatEnd) {
    x = f.stand.x;
    z = f.stand.z;
    rotation = f.heading;
    lower = smooth(clamp01((t - FEED_WALK_S) / 0.5)) * (1 - smooth(clamp01((t - eatEnd + 0.5) / 0.5)));
  } else {
    const k = smooth((t - eatEnd) / FEED_RETURN_S);
    x = f.stand.x + (usual.x - f.stand.x) * k;
    z = f.stand.z + (usual.z - f.stand.z) * k;
    rotation = lerpAngle(f.heading, usual.r, smooth(clamp01((t - eatEnd) / 0.8)));
    walking = 1;
  }
  cow.group.position.x = x;
  cow.group.position.z = z;
  cow.group.rotation.y = rotation;
  const stride = Math.sin(now * 5 + index) * 0.45 * walking;
  cow.legs[0].rotation.z = stride;
  cow.legs[3].rotation.z = stride;
  cow.legs[1].rotation.z = -stride;
  cow.legs[2].rotation.z = -stride;
  cow.head.rotation.z = 0.08 - 0.95 * lower + Math.sin(now * 7) * 0.07 * lower;

  // The hay is eaten away while the cow eats, and is gone by the time it leaves.
  const eaten = clamp01((t - FEED_WALK_S) / FEED_EAT_S);
  f.mesh.visible = t < eatEnd;
  f.mesh.scale.setScalar(Math.max(0.05, 1 - eaten * 0.9) * smooth(clamp01(t / 0.3)));
  // A heart floats up from the cow now and then while it eats.
  f.hearts.forEach((heart, n) => {
    const h = (t - FEED_WALK_S - 0.5 - n * 1.9) / 1.6;
    heart.visible = h > 0 && h < 1;
    if (!heart.visible) return;
    heart.position.set(x + Math.cos(rotation) * 0.5, GROUND_Y + 1.5 + h * 0.9, z - Math.sin(rotation) * 0.5);
    heart.material.opacity = 1 - h * h;
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

// The seasons act on the trees in the shader: the crowns blush pink in spring, turn red,
// orange and yellow in autumn, and under snow every crown and fir wears a white cap. The
// trunk is told from the crown by its colour (brown against green), and a crown's hue is
// picked from how green its own clump is, so each clump differs a little.
const treeSeason = { blossom: { value: 0 }, autumn: { value: 0 }, snow: { value: 0 } };
function patchTreeMaterial(material, isCrown) {
  material.customProgramCacheKey = () => (isCrown ? "tree-crown" : "tree-fir");
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, treeSeason);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vTreeUp;\nvarying float vTreeY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTreeUp = normal.y;\nvTreeY = position.y;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float blossom;\nuniform float autumn;\nuniform float snow;\nvarying float vTreeUp;\nvarying float vTreeY;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        ${isCrown ? `
        float crown = smoothstep(0.02, 0.08, vColor.g - vColor.r);
        float t = clamp((vColor.g - 0.2) / 0.24, 0.0, 1.0);
        vec3 pink = vec3(0.98, 0.7, 0.8) * (0.88 + 0.3 * t);
        vec3 red = vec3(0.74, 0.18, 0.1);
        vec3 orange = vec3(0.92, 0.46, 0.1);
        vec3 yellow = vec3(0.95, 0.74, 0.2);
        vec3 turned = t < 0.5 ? mix(red, orange, t * 2.0) : mix(orange, yellow, (t - 0.5) * 2.0);
        vec3 crownColour = diffuseColor.rgb;
        crownColour = mix(crownColour, pink * diffuse, blossom);
        crownColour = mix(crownColour, turned * diffuse, autumn);
        diffuseColor.rgb = mix(diffuseColor.rgb, crownColour, crown);
        float cap = smoothstep(0.1, 0.5, vTreeUp) * snow * crown;
        ` : `
        float cap = smoothstep(0.3, 0.45, vTreeUp) * smoothstep(0.5, 2.6, vTreeY) * snow;
        `}
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 1.0), cap);`);
  };
}

const TREE_BELTS = [
  { inner: 32, outer: 40, count: 80, haze: 0.16, size: [1.5, 2.6] },
  { inner: 43, outer: 54, count: 130, haze: 0.38, size: [2.0, 3.4] },
].map((belt, beltIndex) => {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, fog: false });
  // The broadleaf trees change with the seasons and the firs do not, so each has its own.
  const leafMaterial = material.clone();
  patchTreeMaterial(material, false);
  patchTreeMaterial(leafMaterial, true);
  const firs = new THREE.InstancedMesh(firGeometry, material, belt.count);
  const leafy = new THREE.InstancedMesh(leafyGeometry, leafMaterial, belt.count);
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
  return { material, leafMaterial, ...belt };
});

// Under snow the paths, the roofs and the firs go white, a little less than the lawn so the
// paths still read as paths. Each colour is mixed from the one it started with, so the
// thaw brings every one of them back exactly.
let snowCovered = null;
function snowCover() {
  if (!snowCovered) {
    const roofs = [coopMat.roof, barnMat.roof, ...cottageMat.thatch];
    snowCovered = [
      [earthMaterial, 0.8], [fringeMaterial, 0.85], [laneMaterial, 0.85], ...stoneMaterials.map((m) => [m, 0.5]), ...roofs.map((m) => [m, 0.86]),
    ].map(([material, amount]) => ({ material, amount, base: material.color.clone() }));
  }
  const white = hillBase.set(0xf2f6fb);
  for (const { material, amount, base } of snowCovered) material.color.copy(base).lerp(white, amount * seasonNow.snow);
}

// The cottage's own tree turns with the seasons the same way the belts do.
let cottageLeaves = null;
const blossomPink = new THREE.Color(0xf6b4c6);
const autumnOrange = new THREE.Color(0xd9661a);
const autumnRed = new THREE.Color(0xb8321a);
function seasonCottageTree() {
  if (!cottageLeaves) cottageLeaves = [cottageMat.leaf, cottageMat.leafLight].map((material) => ({ material, base: material.color.clone() }));
  cottageLeaves.forEach(({ material, base }, i) => {
    material.color.copy(base)
      .lerp(blossomPink, seasonNow.petal)
      .lerp(i ? autumnOrange : autumnRed, seasonNow.fall)
      .lerp(hillBase.set(0xf2f6fb), 0.9 * seasonNow.snow);
  });
}

function updateHills() {
  snowCover();
  seasonCottageTree();
  treeSeason.blossom.value = seasonNow.petal;
  treeSeason.autumn.value = seasonNow.fall;
  treeSeason.snow.value = seasonNow.snow;
  for (const ring of hillRings) {
    hillBase.set(ring.colour);
    for (const channel of ["r", "g", "b"]) {
      hillBase[channel] *= Math.min(1, ambient.color[channel] * ambient.intensity * 1.4);
    }
    hillBase.multiply(seasonNow.hill);
    ring.material.color.copy(hillBase).lerp(skyColour, ring.haze);
  }
  // The trees keep their own colours and shading; the haze is added on top, as fog would.
  for (const belt of TREE_BELTS) {
    belt.material.color.setScalar(1 - belt.haze);
    belt.material.emissive.copy(skyColour).multiplyScalar(belt.haze);
    belt.leafMaterial.color.setScalar(1 - belt.haze);
    belt.leafMaterial.emissive.copy(skyColour).multiplyScalar(belt.haze);
    // Under snow the broadleaf crowns go pale.
    // And the firs carry snow on their boughs.
  }
}

// A chicken coop with a few hens, on the lawn beside the cottage. The hens wander the
// yard in front of it and peck, and like the cows their places are a pure function of
// the server's clock, so every visitor sees them in the same spots. All for show: a hen
// is never in anyone's way, never fed or counted, and nothing depends on where one is.
const COOP_AT = { x: 6, z: -8.6 };
const COOP_SCALE = 0.85; // small enough to sit on the lawn in the middle of the four beds
const HEN_COUNT = 4;
const HEN_SEGMENT_S = 7; // how long one walk-then-peck cycle lasts
const HEN_YARD = 1.1; // how far from the coop's door a hen may wander
const coopMat = {
  wall: flatMaterial(0xc4452f),
  trim: flatMaterial(0xf2ead8),
  roof: flatMaterial(0x6b4a34),
  wood: flatMaterial(0x8a6a48),
  straw: flatMaterial(0xe2c46a),
  dark: flatMaterial(0x2a2420),
  wire: flatMaterial(0xcfc7b4),
};
const henColours = [0xf0e6d2, 0xb8683a, 0x3a3430, 0xd9a24a];
const box = (w, h, d, material, x, y, z) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
};

// The coop faces +z: a little red house on stilts with a ramp down to the yard, a
// pitched roof, a nesting box on the side and a fenced run in front.
const coopGroup = new THREE.Group();
{
  const g = coopGroup;
  for (const [sx, sz] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.6], [0.8, 0.6]]) g.add(box(0.14, 0.5, 0.14, coopMat.wood, sx, 0.25, sz));
  g.add(box(1.9, 0.12, 1.5, coopMat.wood, 0, 0.56, 0)); // floor
  g.add(box(1.8, 1.0, 1.4, coopMat.wall, 0, 1.12, 0)); // walls
  g.add(box(1.86, 0.08, 0.14, coopMat.trim, 0, 0.62, 0.71)); // trim along the floor, proud of both the wall and the floor
  g.add(box(0.5, 0.62, 0.06, coopMat.dark, 0.35, 1.0, 0.72)); // pop hole
  g.add(box(0.58, 0.07, 0.1, coopMat.trim, 0.35, 1.33, 0.73));
  g.add(box(0.5, 0.08, 0.06, coopMat.trim, -0.45, 1.12, 0.73)); // little window
  g.add(box(0.36, 0.3, 0.05, coopMat.dark, -0.45, 1.12, 0.715));
  // A gable of wall colour under the roof at each end, so no gap shows beneath it.
  const gableShape = new THREE.Shape([new THREE.Vector2(-0.88, 0), new THREE.Vector2(0.88, 0), new THREE.Vector2(0, 0.55)]);
  const gableGeometry = new THREE.ExtrudeGeometry(gableShape, { depth: 1.36, bevelEnabled: false });
  const gable = new THREE.Mesh(gableGeometry, coopMat.wall);
  gable.position.set(0, 1.6, -0.68);
  g.add(gable);
  // Pitched roof: two slabs meeting at a ridge, high enough that the walls stay under them.
  for (const side of [1, -1]) {
    const slab = box(1.3, 0.09, 1.8, coopMat.roof, side * 0.57, 1.95, 0);
    slab.rotation.z = -side * 0.5;
    g.add(slab);
  }
  g.add(box(0.16, 0.08, 1.84, coopMat.trim, 0, 2.28, 0));
  // Nesting box on the left side, with straw showing.
  g.add(box(0.5, 0.5, 0.7, coopMat.wall, -1.12, 0.95, 0));
  const lid = box(0.62, 0.06, 0.82, coopMat.roof, -1.12, 1.27, 0);
  lid.rotation.z = 0.2;
  g.add(lid);
  g.add(box(0.4, 0.14, 0.04, coopMat.straw, -1.12, 0.8, 0.37)); // straw showing at the front of the box

  // Ramp from the pop hole down to the grass, with cleats.
  const ramp = box(0.5, 0.05, 1.2, coopMat.wood, 0.35, 0.34, 1.25);
  ramp.rotation.x = 0.4;
  g.add(ramp);
  // Cleats lie on the ramp: each one is moved along the slope and tilted with it.
  for (let k = 0; k < 4; k++) {
    const along = (k + 0.5) / 4 - 0.5; // -0.5 at the top of the ramp, 0.5 at the foot
    const cleat = box(0.5, 0.03, 0.05, coopMat.trim, 0.35, 0.34 - along * 1.2 * Math.sin(0.4) + 0.045, 1.25 + along * 1.2 * Math.cos(0.4));
    cleat.rotation.x = 0.4;
    g.add(cleat);
  }
  // A fenced run in front: posts and two rails round three sides.
  const run = [[-1.2, 0.9], [-1.2, 3.6], [1.9, 3.6], [1.9, 0.9]];
  const rails = (a, b) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    for (const y of [0.22, 0.45]) {
      const rail = box(len, 0.04, 0.04, coopMat.wire, (a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
      rail.rotation.y = -Math.atan2(dz, dx);
      g.add(rail);
    }
  };
  for (let k = 0; k < run.length; k++) {
    g.add(box(0.07, 0.55, 0.07, coopMat.wood, run[k][0], 0.27, run[k][1]));
    if (k < run.length - 1) rails(run[k], run[k + 1]);
  }
  // Mid-posts along the long sides so the rails don't float over empty space.
  for (const x of [-1.2, 1.9]) g.add(box(0.07, 0.55, 0.07, coopMat.wood, x, 0.27, 2.25));
  g.add(box(0.07, 0.55, 0.07, coopMat.wood, 0.35, 0.27, 3.6));
  // A feeder and a drinker in the run.
  g.add(box(0.3, 0.16, 0.3, coopMat.roof, -0.6, 0.08, 3.0));
  const drinker = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.2, 8), coopMat.wire);
  drinker.position.set(1.3, 0.1, 2.9);
  g.add(drinker);
  g.position.set(COOP_AT.x, GROUND_Y, COOP_AT.z);
  g.rotation.y = 0; // the front faces the view you start with
  g.scale.setScalar(COOP_SCALE);
  scene.add(g);
}

// One hen faces +x. The head hangs from a pivot so it can bob and peck, and the tail
// is a small fan. A hen is a handful of the same rounded lumps the cows are made of.
function buildHen(index) {
  const coat = flatMaterial(henColours[index % henColours.length]);
  const beak = flatMaterial(0xe0a030);
  const comb = flatMaterial(0xc8322a);
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  body.position.y = 0.2;
  body.add(cowBlob(0.2, 0.14, 0.13, coat, 0, 0, 0));
  body.add(cowBlob(0.1, 0.1, 0.1, coat, 0.11, 0.03, 0)); // breast
  const tail = new THREE.Group();
  tail.position.set(-0.17, 0.05, 0);
  tail.add(cowBlob(0.1, 0.08, 0.04, coat, -0.05, 0.06, 0));
  tail.rotation.z = 0.5;
  body.add(tail);
  for (const side of [1, -1]) body.add(cowBlob(0.12, 0.07, 0.025, coat, -0.02, 0.0, side * 0.12)); // wings
  const head = new THREE.Group();
  head.position.set(0.18, 0.12, 0);
  head.add(cowBlob(0.045, 0.1, 0.045, coat, 0.0, 0.05, 0)); // neck
  head.add(cowBlob(0.065, 0.06, 0.055, coat, 0.03, 0.12, 0));
  head.add(cowBlob(0.035, 0.015, 0.02, beak, 0.1, 0.115, 0));
  head.add(cowBlob(0.02, 0.03, 0.012, comb, 0.03, 0.18, 0));
  head.add(cowBlob(0.012, 0.012, 0.012, cowMaterials.black, 0.07, 0.14, 0.04));
  head.add(cowBlob(0.012, 0.012, 0.012, cowMaterials.black, 0.07, 0.14, -0.04));
  body.add(head);
  const legs = [];
  for (const side of [0.05, -0.05]) {
    const leg = new THREE.Group();
    leg.position.set(0.0, -0.1, side);
    leg.add(cowBlob(0.012, 0.09, 0.012, beak, 0, -0.07, 0));
    leg.add(cowBlob(0.04, 0.012, 0.03, beak, 0.02, -0.15, 0));
    body.add(leg);
    legs.push(leg);
  }
  return { group, body, head, tail, legs };
}

const hens = Array.from({ length: HEN_COUNT }, (_, i) => {
  const hen = buildHen(i);
  hen.group.position.y = GROUND_Y;
  hen.group.scale.setScalar(0.95);
  scene.add(hen.group);
  return hen;
});

// Where a hen is in the yard for one cycle: in front of the coop, in its own turn.
function henSpot(index, cycle) {
  const a = seeded(index * 131 + cycle * 5.7) * Math.PI * 2;
  const r = 0.4 + seeded(index * 71 + cycle * 2.3) * HEN_YARD;
  // The yard is a patch just outside the run, in front of the coop's door.
  const along = Math.cos(a) * r;
  const out = 3.6 * COOP_SCALE + 1.3 + Math.sin(a) * r * 0.7; // always past the run's fence
  const turn = coopGroup.rotation.y;
  const x = COOP_AT.x + Math.sin(turn) * out + Math.cos(turn) * (along + 0.4);
  const z = COOP_AT.z + Math.cos(turn) * out - Math.sin(turn) * (along + 0.4);
  return { x, z };
}

function updateHens(timeSeconds) {
  hens.forEach((hen, i) => {
    const t = timeSeconds / HEN_SEGMENT_S + i * 0.29;
    const cycle = Math.floor(t);
    const p = t - cycle;
    const from = henSpot(i, cycle);
    const to = henSpot(i, cycle + 1);
    const before = henSpot(i, cycle - 1);
    const headingTo = Math.atan2(-(to.z - from.z), to.x - from.x);
    const headingFrom = Math.atan2(-(from.z - before.z), from.x - before.x);
    const turn = smooth(clamp01(p / 0.1));
    let delta = headingTo - headingFrom;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    const walk = smooth(clamp01((p - 0.1) / 0.25));
    hen.group.rotation.y = headingFrom + delta * turn;
    hen.group.position.x = from.x + (to.x - from.x) * walk;
    hen.group.position.z = from.z + (to.z - from.z) * walk;

    const walking = p > 0.1 && p < 0.35 ? 1 : 0;
    const step = Math.sin(timeSeconds * 14 + i * 2) * 0.6 * walking;
    hen.legs[0].rotation.z = step;
    hen.legs[1].rotation.z = -step;
    hen.body.position.y = 0.2 + Math.abs(step) * 0.02;
    // Walking, the head bobs forward and back; standing, it pecks at the ground in
    // quick bursts, and now and then lifts to look about.
    const peckTime = timeSeconds * 6 + i * 1.7;
    const peck = walking ? 0 : Math.max(0, Math.sin(peckTime)) ** 3 * (Math.sin(timeSeconds * 0.6 + i * 3) > -0.2 ? 1 : 0);
    hen.head.position.x = 0.18 + (walking ? Math.sin(timeSeconds * 14 + i * 2) * 0.02 : 0);
    hen.head.rotation.z = -1.1 * peck;
    hen.tail.rotation.z = 0.5 + Math.sin(timeSeconds * 2 + i) * 0.05;
    if (hen.pet) updatePet(hen);
    else if (hen.body.scale.x !== 1) hen.body.scale.setScalar(1);
  });
}

// Petting a hen: click one and she puffs up, hops a little and a heart floats up. Like
// feeding a cow, this is a way of looking and nothing more: it is only in your own page,
// sends nothing to the server, is never stored or counted, and the hen keeps to her usual
// round underneath. Someone else's hen is not touched on their screen.
const PET_S = 2.2;
function petHen(hen) {
  if (hen.pet) return; // already being stroked: a second click does nothing
  tellAnimal("hen", hens.indexOf(hen));
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: getHeartTexture(), transparent: true, depthWrite: false }));
  heart.scale.set(0.3, 0.3, 1);
  heart.visible = false;
  scene.add(heart);
  hen.pet = { start: performance.now() / 1000, heart };
  showStatusMessage("You stroked the hen");
}

// Layered on top of the hen's usual motion, so it runs after it each frame.
function updatePet(hen) {
  const t = performance.now() / 1000 - hen.pet.start;
  const heart = hen.pet.heart;
  if (t >= PET_S) {
    scene.remove(heart);
    heart.material.dispose();
    hen.pet = null;
    return;
  }
  const settle = 1 - smooth(clamp01((t - 0.2) / 1.6));
  if (!stillMotion.matches) {
    hen.body.position.y += Math.abs(Math.sin(t * 9)) * 0.035 * settle;
    hen.tail.rotation.z += Math.sin(t * 22) * 0.12 * settle;
  }
  // Chest out and head up, then back down.
  hen.head.rotation.z = -0.25 * settle;
  hen.body.scale.setScalar(1 + 0.12 * Math.sin(Math.PI * clamp01(t / 0.7)));
  const h = clamp01(t / PET_S);
  heart.visible = true;
  heart.position.set(hen.group.position.x, GROUND_Y + 0.55 + h * 0.5, hen.group.position.z);
  heart.material.opacity = 1 - h * h;
}

// Your pet: the reward after the last decoration, only ever drawn in your own garden and
// only ever from your own `pet` event, so nobody else sees it or its name. The kind and the
// name are the server's; the page only draws them. It wanders along the front and right of
// your bed (clear of the props), and you can stroke it or feed it. Both are a way of looking
// and nothing more, like the hens and cows: nothing is sent, stored, counted or logged.
let petKinds = [];
let petState = { unlocked: false, pet: null };
let petObj = null; // the drawn pet: { kind, group, body, head, tail, legs, tag, ... }

const PET_COLOURS = {
  cat: { coat: 0xd98e4a, mark: 0xa8602a, pale: 0xf6ecdc, nose: 0xe8a0a8, eye: 0x86bf3c },
  dog: { coat: 0xb9814a, mark: 0x6a4326, pale: 0xf0e2c8, nose: 0x2a1f1a, eye: 0x3a2a1c },
  rabbit: { coat: 0xa89888, mark: 0x6b5d50, pale: 0xf5f0e6, nose: 0xe8a0a8, eye: 0x1c1613 },
};
// How big each is drawn, and how long its legs are (so its paws meet the ground).
const PET_SIZE = { cat: { scale: 1.25, baseY: 0.215 }, dog: { scale: 1.2, baseY: 0.273 }, rabbit: { scale: 1.45, baseY: 0.15 } };
// The path it walks: along the front of the bed, in bed-local x,z. It keeps clear of the
// hedge or fence behind it and of the garden lights at the corner and along the path in, so
// it never walks through them.
const PET_PATH_START = [-1.8, 3.12];
const PET_PATH_LENGTH = 3.0;
const PET_SPEED = 0.45;
const PET_INDOOR_SCALE = 0.55;
const PET_KEEP_OUT = 0.5; // how close you may come to your pet indoors

// How high the ground is under a spot, in world units: the lawn, a stone you can step up
// onto in the garden, or the planks and the rug in the cottage.
function petFloorAt(x, z) {
  if (petIndoors()) {
    const d = Math.hypot(x - room.at.x, z - (room.at.z + 0.3));
    const rug = d < 0.6 ? 0.055 : d < 0.95 ? 0.0475 : d < 1.35 ? 0.04 : d < 1.6 ? 0.0325 : 0.02;
    return GROUND_Y + rug;
  }
  let top = GROUND_Y;
  for (const stone of petStones) {
    if (stone.top > top && Math.hypot(x - stone.x, z - stone.z) < stone.r) top = stone.top;
  }
  return top;
}

// Indoors the pet wanders along a line across the rug in front of the hearth.
const petBox = new THREE.Box3();
const petPoint3 = new THREE.Vector3();
const PET_ROOM_LENGTH = 3;
function petRoomPoint(distance) {
  return [-1.5 + Math.min(Math.max(distance, 0), PET_ROOM_LENGTH), 1.1];
}
const petIndoors = () => interiorMode && room !== null && room.pet === true;
const petLength = () => (petIndoors() ? PET_ROOM_LENGTH : PET_PATH_LENGTH);
const petPoint = (distance) => (petIndoors() ? petRoomPoint(distance) : petPathPoint(distance));

function petPathPoint(distance) {
  return [PET_PATH_START[0] + Math.min(Math.max(distance, 0), PET_PATH_LENGTH), PET_PATH_START[1]];
}

function buildPetModel(kind) {
  const c = PET_COLOURS[kind];
  const coat = flatMaterial(c.coat);
  const mark = flatMaterial(c.mark);
  const pale = flatMaterial(c.pale);
  const nose = flatMaterial(c.nose);
  const iris = flatMaterial(c.eye);
  const black = flatMaterial(0x16110e);
  const cat = kind === "cat";
  const dog = kind === "dog";
  const rabbit = kind === "rabbit";
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const put = (parent, rx, ry, rz, material, x = 0, y = 0, z = 0) => {
    const mesh = cowBlob(rx, ry, rz, material, x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const eyes = [];
  const eye = (parent, material, rx, ry, rz, x, y, z) => {
    const mesh = put(parent, rx, ry, rz, material, x, y, z);
    eyes.push({ mesh, sy: ry });
    return mesh;
  };
  const whiskers = (parent, x, y, spread) => {
    for (const side of [1, -1]) {
      for (const [i, lift] of [-0.012, 0, 0.012].entries()) {
        const w = put(parent, 0.004, 0.0015, 0.055, pale, x, y + lift, side * spread);
        w.rotation.y = side * (0.35 + i * 0.2);
      }
    }
  };

  // The body, built from a few overlapping lumps so it has a chest, a waist and hips.
  if (cat) {
    put(body, 0.115, 0.1, 0.082, coat, 0.09, 0, 0);
    put(body, 0.13, 0.088, 0.078, coat, 0, -0.005, 0);
    put(body, 0.12, 0.1, 0.088, coat, -0.1, 0.005, 0);
    put(body, 0.06, 0.06, 0.05, pale, 0.15, -0.03, 0); // white bib
    for (const x of [0.07, 0.0, -0.07, -0.13]) put(body, 0.014, 0.022, 0.062, mark, x, 0.088, 0); // tabby stripes
  } else if (dog) {
    put(body, 0.17, 0.15, 0.11, coat, 0.13, 0, 0);
    put(body, 0.17, 0.12, 0.1, coat, 0, -0.01, 0);
    put(body, 0.16, 0.13, 0.105, coat, -0.14, 0.005, 0);
    put(body, 0.1, 0.09, 0.085, pale, 0.19, -0.05, 0); // pale chest
    put(body, 0.13, 0.05, 0.1, mark, -0.03, 0.095, 0); // dark saddle
  } else {
    put(body, 0.15, 0.115, 0.1, coat, 0, 0, 0);
    put(body, 0.11, 0.12, 0.1, coat, -0.06, 0.02, 0);
    put(body, 0.08, 0.09, 0.075, coat, 0.1, -0.01, 0);
    for (const side of [1, -1]) put(body, 0.085, 0.1, 0.045, coat, -0.07, -0.02, side * 0.085); // haunches
    put(body, 0.1, 0.045, 0.07, pale, 0.02, -0.075, 0); // pale belly
  }

  // The head hangs from a pivot at the base of the neck, so it can turn, nod and lower.
  // The neck bends from the shoulders, and the head from the top of the neck, so a pet can
  // lower its whole front to reach the ground.
  const neckAt = cat ? [0.12, 0.04] : dog ? [0.2, 0.08] : [0.1, 0.05];
  const headAt = [cat ? 0.17 : dog ? 0.27 : 0.16, cat ? 0.075 : dog ? 0.14 : 0.09];
  const neck = new THREE.Group();
  neck.position.set(neckAt[0], neckAt[1], 0);
  body.add(neck);
  put(neck, cat ? 0.055 : dog ? 0.08 : 0.05, cat ? 0.065 : dog ? 0.09 : 0.05, cat ? 0.055 : dog ? 0.075 : 0.05, coat, (cat ? 0.15 : dog ? 0.22 : 0.14) - neckAt[0], (cat ? 0.05 : dog ? 0.09 : 0.06) - neckAt[1], 0);
  const head = new THREE.Group();
  head.position.set(headAt[0] - neckAt[0], headAt[1] - neckAt[1], 0);
  neck.add(head);
  const ears = [];
  const ear = (side, tx, ty, rx, ry, rz, material, tilt) => {
    const pivot = new THREE.Group();
    pivot.position.set(tx, ty, side * (cat ? 0.045 : dog ? 0.06 : 0.03));
    put(pivot, rx, ry, rz, material, 0, ry * 0.85, 0);
    pivot.userData = { baseX: side * tilt.x, baseZ: tilt.z, side };
    pivot.rotation.set(pivot.userData.baseX, 0, pivot.userData.baseZ);
    head.add(pivot);
    ears.push(pivot);
    return pivot;
  };
  let noseMesh = null;
  if (cat) {
    put(head, 0.075, 0.07, 0.075, coat, 0.045, 0.045, 0);
    put(head, 0.032, 0.022, 0.04, pale, 0.1, 0.025, 0); // muzzle
    noseMesh = put(head, 0.011, 0.008, 0.014, nose, 0.128, 0.04, 0);
    for (const side of [1, -1]) {
      const e = ear(side, 0.025, 0.085, 0.018, 0.05, 0.034, coat, { x: 0.25, z: -0.1 });
      put(e, 0.008, 0.032, 0.022, nose, 0.008, 0.04, 0); // pink inside
      eye(head, iris, 0.009, 0.017, 0.016, 0.098, 0.065, side * 0.04);
      put(head, 0.005, 0.015, 0.007, black, 0.106, 0.065, side * 0.04); // slit pupil
    }
    whiskers(head, 0.115, 0.03, 0.04);
    put(head, 0.012, 0.03, 0.03, mark, 0.04, 0.105, 0); // forehead stripe
  } else if (dog) {
    put(head, 0.09, 0.085, 0.08, coat, 0.04, 0.05, 0);
    put(head, 0.075, 0.042, 0.048, pale, 0.135, 0.02, 0); // snout
    put(head, 0.03, 0.012, 0.03, pale, 0.15, -0.01, 0); // chin
    noseMesh = put(head, 0.016, 0.014, 0.022, nose, 0.205, 0.04, 0);
    put(head, 0.035, 0.005, 0.022, nose, 0.14, -0.012, 0).scale.set(0.035, 0.007, 0.022); // mouth line
    for (const side of [1, -1]) {
      ear(side, 0.0, 0.09, 0.028, 0.06, 0.018, mark, { x: 0.35, z: 3.1 }).children[0].position.set(0, -0.045, 0); // floppy
      eye(head, black, 0.011, 0.014, 0.011, 0.098, 0.075, side * 0.045);
      put(head, 0.03, 0.008, 0.012, mark, 0.09, 0.098, side * 0.045); // brows
    }
    const tongue = put(head, 0.02, 0.006, 0.014, nose, 0.15, -0.015, 0);
    tongue.visible = false;
    head.userData.tongue = tongue;
  } else {
    put(head, 0.075, 0.068, 0.062, coat, 0.04, 0.03, 0);
    for (const side of [1, -1]) {
      put(head, 0.035, 0.032, 0.03, pale, 0.075, 0.0, side * 0.035); // cheeks
      const e = ear(side, -0.01, 0.085, 0.018, 0.13, 0.03, coat, { x: 0.12, z: -0.3 });
      put(e, 0.008, 0.08, 0.02, nose, 0.006, 0.0, 0); // pink inside
      put(e, 0.02, 0.025, 0.032, mark, 0, 0.26, 0); // dark tips
      eye(head, black, 0.013, 0.017, 0.009, 0.075, 0.055, side * 0.058);
      put(head, 0.004, 0.005, 0.003, flatMaterial(0xffffff), 0.082, 0.062, side * 0.063);
    }
    noseMesh = put(head, 0.012, 0.01, 0.014, nose, 0.112, 0.04, 0);
    whiskers(head, 0.105, 0.02, 0.03);
  }

  // The tail: a few joints in a chain for a cat's, which lets it curl, a dog's that wags,
  // and a rabbit's small puff.
  const tails = [];
  if (!rabbit) {
    const joints = cat ? 3 : 2;
    const size = cat ? { rx: 0.05, r: 0.02, step: 0.09 } : { rx: 0.06, r: 0.026, step: 0.11 };
    let parent = body;
    for (let i = 0; i < joints; i++) {
      const joint = new THREE.Group();
      joint.position.set(i === 0 ? (cat ? -0.2 : -0.28) : -size.step, i === 0 ? 0.04 : 0, 0);
      put(joint, size.rx, size.r, size.r, i === joints - 1 && cat ? mark : coat, -size.step / 2, 0, 0);
      parent.add(joint);
      tails.push(joint);
      parent = joint;
    }
    tails[0].userData.rest = cat ? -1.1 : -0.8;
    tails[1].userData.rest = cat ? 0.45 : 0.5;
    if (cat) tails[2].userData.rest = 0.5;
  } else {
    put(body, 0.05, 0.05, 0.05, pale, -0.16, 0.04, 0);
  }

  // Four legs hung from their hips, front pair first: front left, front right, back left,
  // back right. Walkers swing them in diagonal pairs and a rabbit's tuck up as it hops.
  const legs = [];
  const leg = (x, z, len, w, hind) => {
    const g = new THREE.Group();
    g.position.set(x, -0.03, z);
    if (rabbit) {
      if (hind) {
        put(g, 0.075, 0.016, 0.022, coat, 0.045, -0.1, 0); // the long hind foot
      } else {
        put(g, 0.013, len * 0.5, 0.013, coat, 0, -len * 0.5, 0);
        put(g, 0.025, 0.014, 0.02, pale, 0.01, -len * 0.97, 0);
      }
    } else {
      put(g, w * 1.25, len * 0.3, w * 1.05, coat, 0, -len * 0.22, 0); // thigh
      put(g, w * 0.7, len * 0.4, w * 0.7, coat, 0, -len * 0.62, 0); // shin
      put(g, w * 1.4, 0.02, w * 1.15, hind && dog ? coat : pale, w * 0.55, -len * 0.97, 0); // paw
    }
    body.add(g);
    legs.push(g);
  };
  if (rabbit) {
    leg(0.1, 0.04, 0.06, 0.014, false);
    leg(0.1, -0.04, 0.06, 0.014, false);
    leg(-0.07, 0.085, 0.1, 0.02, true);
    leg(-0.07, -0.085, 0.1, 0.02, true);
  } else {
    const len = cat ? 0.17 : 0.23;
    const w = cat ? 0.022 : 0.03;
    const fx = cat ? 0.1 : 0.15;
    const bx = cat ? -0.1 : -0.15;
    const z = cat ? 0.05 : 0.07;
    leg(fx, z, len, w, false);
    leg(fx, -z, len, w, false);
    leg(bx, z, len, w, true);
    leg(bx, -z, len, w, true);
  }

  const size = PET_SIZE[kind];
  group.scale.setScalar(size.scale);
  body.position.y = size.baseY;
  const meshes = [];
  group.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  return { kind, group, body, baseY: size.baseY, neck, head, ears, tails, legs, eyes, nose: noseMesh, meshes, lift: 0 };
}

// The name over its head, drawn as text on a canvas, never as page markup.
function buildPetTag(name) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "700 40px 'Caveat', 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(255,250,235,0.95)";
  ctx.strokeText(name, 128, 34);
  ctx.fillStyle = "#4a3a22";
  ctx.fillText(name, 128, 34);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }));
  sprite.scale.set(1.0, 0.25, 1);
  sprite.visible = false;
  return sprite;
}

function removePet() {
  if (!petObj) return;
  scene.remove(petObj.group);
  scene.remove(petObj.tag);
  petObj.tag.material.map.dispose();
  petObj.tag.material.dispose();
  endPetFeed();
  petObj = null;
}

function syncPet() {
  const pet = petState.pet;
  if (!pet || !PET_COLOURS[pet.kind]) {
    removePet();
    return;
  }
  if (petObj && petObj.kind === pet.kind && petObj.name === pet.name) return;
  const keep = petObj ? { distance: petObj.distance, target: petObj.target, side: petObj.side } : null;
  removePet();
  petObj = buildPetModel(pet.kind);
  petObj.name = pet.name;
  petObj.tag = buildPetTag(pet.name);
  petObj.distance = keep?.distance ?? 2;
  petObj.target = keep?.target ?? 2;
  petObj.heading = 0;
  petObj.lastTime = performance.now() / 1000;
  petObj.cycle = -1;
  petObj.gaitT = 0;
  petObj.hopT = 0;
  scene.add(petObj.group);
  scene.add(petObj.tag);
}

const petPanel = document.getElementById("own-pet");
const petForm = document.getElementById("pet-form");
const petKindsBox = document.getElementById("pet-kinds");
const petNameInput = document.getElementById("pet-name");
// Only letters go in, and the first is a capital, as you type. The server checks it all the same.
petNameInput.addEventListener("input", () => {
  const letters = petNameInput.value.replace(/[^A-Za-z]/g, "");
  const tidy = letters.charAt(0).toUpperCase() + letters.slice(1);
  if (tidy !== petNameInput.value) petNameInput.value = tidy;
});
const petNote = document.getElementById("pet-note");
const petFeedButton = document.getElementById("pet-feed");
const PET_KIND_LABEL = { cat: "Cat", dog: "Dog", rabbit: "Rabbit" };
let petDraftKind = null;
let petHeard = false;

// The toast that says something has unlocked: a decoration, or a pet. It is only in your
// own page and nothing is sent: it is a message, not a badge, so it goes when you close it
// or leave it a while. If two unlock together they show one after the other.
const unlockToast = document.getElementById("unlock-toast");
const toastTitle = document.getElementById("toast-title");
const toastBody = document.getElementById("toast-body");
const toastQueue = [];
let toastCurrent = null;
let toastTimer = 0;
const PET_TOAST_KEY = "petToastSeen";
const DECOR_TOLD_KEY = "decorTold";
function petToastSeen() {
  try {
    return localStorage.getItem(PET_TOAST_KEY) === "1";
  } catch {
    return false;
  }
}
// How many decorations this browser has already said so about, or null if it has not looked
// yet (so a first visit with some already unlocked does not shout about all of them).
function decorTold() {
  try {
    const value = localStorage.getItem(DECOR_TOLD_KEY);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}
function rememberDecorTold(count) {
  try {
    localStorage.setItem(DECOR_TOLD_KEY, String(count));
  } catch {}
}
function toastWhere() {
  return window.matchMedia("(max-width: 700px)").matches ? "at the bottom of the screen" : "on the left";
}
function pushToast(kind, title, body) {
  toastQueue.push({ kind, title, body });
  if (!toastCurrent) showNextToast();
}
function showNextToast() {
  toastCurrent = toastQueue.shift() ?? null;
  clearTimeout(toastTimer);
  if (!toastCurrent) {
    unlockToast.hidden = true;
    return;
  }
  toastTitle.textContent = toastCurrent.title;
  toastBody.textContent = toastCurrent.body;
  unlockToast.hidden = false;
  toastTimer = setTimeout(hideUnlockToast, 15000);
}
function hideUnlockToast() {
  clearTimeout(toastTimer);
  toastCurrent = null;
  unlockToast.hidden = true;
  if (toastQueue.length > 0) setTimeout(showNextToast, 350);
}
function showPetToast() {
  try {
    localStorage.setItem(PET_TOAST_KEY, "1");
  } catch {}
  pushToast("pet", "You've unlocked pets!", `A pet is waiting in My garden. Open your journal ${toastWhere()} and look under Your pet to choose one and give it a name.`);
}
document.getElementById("toast-close").addEventListener("click", hideUnlockToast);
document.getElementById("toast-go").addEventListener("click", () => {
  hideUnlockToast();
  if (!ownMode) openOwnGarden();
  const toggle = document.getElementById("gardener-toggle");
  if (toggle.getAttribute("aria-expanded") === "false") toggle.click();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !unlockToast.hidden) hideUnlockToast();
});

function renderPetKinds() {
  petKindsBox.replaceChildren(
    ...petKinds.map((kind) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.kind = kind;
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", String(kind === petDraftKind));
      button.textContent = PET_KIND_LABEL[kind] ?? kind;
      return button;
    }),
  );
}

// Whether a pet is waiting, and the one you have. Before it unlocks the section is there but
// locked, and says only that: no count, no way of chasing it.
function renderPet(state) {
  const wasUnlocked = petState.unlocked;
  const first = !petHeard;
  petHeard = true;
  petState = state;
  // Tell you once, in the middle of the screen, that a pet is waiting: when it unlocks while
  // you are here, or the first time this browser opens the garden with one unclaimed.
  if (state.unlocked && !state.pet && (first ? !petToastSeen() : !wasUnlocked)) showPetToast();
  if (state.pet && toastCurrent?.kind === "pet") hideUnlockToast();
  // Always there in your own garden: locked, with a padlock, until a pet has been unlocked.
  petPanel.hidden = false;
  petPanel.classList.toggle("locked", !state.unlocked);
  document.getElementById("pet-locked").hidden = state.unlocked;
  petForm.hidden = !state.unlocked;
  petNote.hidden = !state.unlocked;
  petFeedButton.hidden = !state.pet;
  if (state.pet) {
    petDraftKind = state.pet.kind;
    if (document.activeElement !== petNameInput) petNameInput.value = state.pet.name;
    petNote.textContent = `${state.pet.name} is in your garden.`;
  } else {
    petDraftKind ??= petKinds[0] ?? null;
    petNote.textContent = state.unlocked ? "A pet is waiting for you. Choose a kind and a name." : "";
  }
  renderPetKinds();
  syncPet();
}

petKindsBox.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-kind]");
  if (!button) return;
  petDraftKind = button.dataset.kind;
  renderPetKinds();
  petKindsBox.querySelector(`[data-kind="${petDraftKind}"]`)?.focus({ preventScroll: true });
});

petForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (Date.now() < actionsPausedUntil) {
    petNote.textContent = SLOW_DOWN_MESSAGE;
    return;
  }
  try {
    const res = await fetch("/api/own-garden/pet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: petDraftKind, name: petNameInput.value }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 429) {
        const seconds = Number(res.headers.get("retry-after"));
        actionsPausedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 5) * 1000;
      }
      // The server's own words: it is the one that knows what a name may be.
      petNote.textContent = body.error ?? "That didn't work just now.";
    }
  } catch {
    petNote.textContent = "Couldn't reach the server — try again.";
  }
});

// A generous ball round the pet, like the hens'.
const PET_REACH = 0.42;
function petUnderPointer() {
  if (!petObj) return null;
  const centre = new THREE.Vector3(petObj.group.position.x, GROUND_Y + 0.3, petObj.group.position.z);
  const point = new THREE.Vector3();
  if (!raycaster.ray.intersectSphere(new THREE.Sphere(centre, PET_REACH), point)) return null;
  return { distance: point.distanceTo(raycaster.ray.origin) };
}

const PET_STROKE_S = 2.2;
const PET_FEED_S = 8;
function addPetHeart() {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getHeartTexture(), transparent: true, depthWrite: false }));
  sprite.scale.set(0.3, 0.3, 1);
  sprite.visible = false;
  scene.add(sprite);
  return sprite;
}
function removePetHearts(hearts) {
  for (const heart of hearts) {
    scene.remove(heart);
    heart.material.dispose();
  }
}

function strokePet() {
  if (!petObj || petObj.stroke) return;
  petObj.stroke = { start: performance.now() / 1000, hearts: [addPetHeart()] };
  showStatusMessage(`You stroked ${petObj.name}`);
}

// What each kind is fed, and how far in front of it the dish goes so its nose reaches. A dog
// gets kibble in a bowl, a cat a fish on a saucer, and a rabbit a carrot with its leaves.
const FOOD_DIST = { cat: 0.4, dog: 0.56, rabbit: 0.44 };
function buildPetFood(kind) {
  const group = new THREE.Group();
  const materials = [];
  const mat = (colour, double = false) => {
    const m = flatMaterial(colour);
    if (double) m.side = THREE.DoubleSide;
    materials.push(m);
    return m;
  };
  const geometries = [];
  const dish = (radius, height, colour, rim) => {
    const profile = [[0.001, 0], [radius * 0.62, 0], [radius, height], [radius * 0.92, height], [radius * 0.55, 0.012], [0.001, 0.012]].map(([x, y]) => new THREE.Vector2(x, y));
    const geometry = new THREE.LatheGeometry(profile, 14);
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, mat(colour, true));
    group.add(mesh);
    if (rim) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius * 0.7, 0.012, 14, 1, true), mat(rim, true));
      geometries.push(band.geometry);
      band.position.y = height * 0.45;
      group.add(band);
    }
  };
  const lump = (rx, ry, rz, colour, x, y, z) => {
    const mesh = cowBlob(rx, ry, rz, mat(colour), x, y, z);
    group.add(mesh);
    return mesh;
  };
  // Pieces that are eaten one after another, tip or near side first.
  const pieces = [];
  if (kind === "dog") {
    dish(0.15, 0.07, 0x4f7fb0, 0xe8e2d4);
    const browns = [0x8a5a30, 0x9a6a3a, 0x7a4a26];
    for (let i = 0; i < 16; i++) {
      const a = seeded(i * 3.1) * Math.PI * 2;
      const r = Math.sqrt(seeded(i * 7.7 + 1)) * 0.095;
      const mound = 1 - r / 0.11;
      const piece = lump(0.024, 0.018, 0.024, browns[i % 3], Math.cos(a) * r, 0.03 + mound * 0.04, Math.sin(a) * r);
      piece.rotation.set(seeded(i) * 3, seeded(i + 9) * 3, 0);
      pieces.push({ mesh: piece, order: -Math.cos(a) * r + seeded(i * 1.9) * 0.05 });
    }
  } else if (kind === "cat") {
    dish(0.13, 0.035, 0xe8dcc4, 0x6a8fb8);
    const silver = 0xaab8c8;
    const belly = 0xdde4ea;
    // A fish lying across the saucer, head towards the cat, in four pieces and a bare backbone.
    const parts = [
      { x: -0.07, rx: 0.036, ry: 0.032, rz: 0.026 },
      { x: -0.02, rx: 0.045, ry: 0.036, rz: 0.028 },
      { x: 0.04, rx: 0.04, ry: 0.03, rz: 0.024 },
      { x: 0.095, rx: 0.028, ry: 0.034, rz: 0.006 },
    ];
    parts.forEach((part, i) => {
      const body = lump(part.rx, part.ry, part.rz, i === 3 ? 0x8898aa : silver, part.x, 0.05, 0);
      lump(part.rx * 0.8, part.ry * 0.45, part.rz * 1.05, belly, part.x, 0.036, 0);
      pieces.push({ mesh: body, order: i, extra: group.children[group.children.length - 1] });
    });
    lump(0.006, 0.006, 0.006, 0x16110e, -0.092, 0.06, 0.02);
    const eyeFish = group.children[group.children.length - 1];
    pieces[0].eye = eyeFish;
    group.userData.bones = [0.0, 0.045, 0.08].map((x) => lump(0.004, 0.012, 0.03, 0xf2eee4, x - 0.03, 0.03, 0));
    group.userData.bones.forEach((b) => (b.visible = false));
    group.userData.spine = lump(0.1, 0.004, 0.004, 0xf2eee4, 0.0, 0.03, 0);
    group.userData.spine.visible = false;
  } else {
    // A carrot lying with its leafy top away from the rabbit, in three bites, and a few leaves.
    const orange = [0xe8812a, 0xdf7420, 0xd6691a];
    const radii = [[0.004, 0.022], [0.022, 0.034], [0.034, 0.04]];
    radii.forEach(([top, bottom], i) => {
      const geometry = new THREE.CylinderGeometry(top, bottom, 0.08, 9);
      geometries.push(geometry);
      const mesh = new THREE.Mesh(geometry, mat(orange[i]));
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(-0.08 + i * 0.08, 0.04, 0);
      group.add(mesh);
      pieces.push({ mesh, order: i });
    });
    const leaves = [0x4f9a3a, 0x5aab44, 0x428a30].map((colour, i) => lump(0.07, 0.008, 0.022, colour, 0.17 + i * 0.01, 0.045 + i * 0.006, (i - 1) * 0.04));
    leaves.forEach((leaf, i) => (leaf.rotation.y = (i - 1) * 0.5));
    group.userData.leaves = leaves;
    // A lettuce leaf beside it, crinkled from a couple of overlapping lumps.
    lump(0.07, 0.01, 0.055, 0x7cc05a, 0.02, 0.012, 0.13).rotation.y = 0.4;
    lump(0.05, 0.012, 0.04, 0x90d06a, 0.0, 0.02, 0.14).rotation.y = -0.3;
  }
  pieces.sort((x, y) => x.order - y.order);
  return { group, materials, geometries, pieces };
}

function feedPet() {
  if (!petObj || petObj.feed) return;
  const pet = petObj;
  const forward = new THREE.Vector2(Math.cos(pet.heading), -Math.sin(pet.heading));
  const food = buildPetFood(pet.kind);
  const dist = FOOD_DIST[pet.kind];
  const dishX = pet.group.position.x + forward.x * dist;
  const dishZ = pet.group.position.z + forward.y * dist;
  food.group.position.set(dishX, petFloorAt(dishX, dishZ), dishZ);
  // The dish's own +x points the way the pet faces, so the near side is where it starts eating.
  food.group.rotation.y = pet.heading;
  scene.add(food.group);
  food.group.scale.setScalar(0.01);
  pet.feed = { start: performance.now() / 1000, food, forward, hearts: [addPetHeart(), addPetHeart(), addPetHeart()] };
  showStatusMessage(`You fed ${pet.name}`);
}

function endPetFeed() {
  const feed = petObj?.feed;
  if (!feed) return;
  scene.remove(feed.food.group);
  for (const geometry of feed.food.geometries) geometry.dispose();
  for (const material of feed.food.materials) material.dispose();
  removePetHearts(feed.hearts);
  petObj.feed = null;
}

petFeedButton.addEventListener("click", feedPet);

// How each kind moves: a cat strolls, a dog trots, and a rabbit hops in short leaps with
// a pause to crouch between them.
const PET_GAIT = {
  cat: { speed: 0.4, swing: 0.5, rate: 8 },
  dog: { speed: 0.68, swing: 0.6, rate: 12 },
  rabbit: { speed: 0.85, hop: 0.62 },
};

function updatePetFrame() {
  if (!petObj) return;
  const pet = petObj;
  const now = performance.now() / 1000;
  const dt = Math.min(Math.max(now - pet.lastTime, 0), 0.1);
  pet.lastTime = now;
  const still = stillMotion.matches;
  const gait = PET_GAIT[pet.kind];
  const cat = pet.kind === "cat";
  const dog = pet.kind === "dog";
  const rabbit = pet.kind === "rabbit";

  // Wander: pick somewhere on the path every few seconds and go there, but stand still
  // while eating.
  const cycle = Math.floor(now / 8);
  if (cycle !== pet.cycle) {
    pet.cycle = cycle;
    pet.target = seeded(cycle * 13.1 + 0.5) * petLength();
  }
  // Coming in from the garden, or going back out, it keeps to the line it has.
  pet.distance = Math.min(pet.distance, petLength());
  pet.target = Math.min(pet.target, petLength());
  const gap = pet.target - pet.distance;
  const moving = !pet.feed && !still && Math.abs(gap) > 0.03 ? 1 : 0;

  let step = 0;
  let air = 0;
  let pitch = 0;
  let crouch = 0;
  if (rabbit) {
    // A hop is the first 60% of its cycle: crouch, leap, land. It carries on until it has
    // landed even if it has arrived, so it never stops in mid air.
    const p0 = (pet.hopT % gait.hop) / gait.hop;
    if (moving || (p0 > 0 && p0 < 0.6 && !still)) pet.hopT += dt;
    const p = (pet.hopT % gait.hop) / gait.hop;
    if (p < 0.6) {
      const k = p / 0.6;
      air = Math.sin(Math.PI * k);
      pitch = 0.35 * Math.cos(Math.PI * k);
      if (moving) step = gait.speed * dt;
    } else {
      crouch = Math.sin(Math.PI * ((p - 0.6) / 0.4));
    }
  } else if (moving) {
    pet.gaitT += dt * gait.rate;
    step = gait.speed * dt;
  }
  if (step > 0 && petIndoors()) {
    // It waits rather than walk through you.
    const [nx, nz] = petPoint(pet.distance + Math.sign(gap) * 0.15);
    const [cx, cz] = petPoint(pet.distance);
    const near = Math.hypot(nx - walker.x, nz - walker.z);
    if (near < PET_KEEP_OUT && near < Math.hypot(cx - walker.x, cz - walker.z)) step = 0;
  }
  if (step > 0) {
    const dir = Math.sign(gap);
    const here = petPoint(pet.distance);
    const ahead = petPoint(pet.distance + dir * 0.1);
    if (ahead[0] !== here[0] || ahead[1] !== here[1]) {
      const goal = Math.atan2(-(ahead[1] - here[1]), ahead[0] - here[0]);
      pet.heading = lerpAngle(pet.heading, goal, Math.min(1, dt * 8));
    }
    pet.distance += dir * Math.min(step, Math.abs(gap));
  }
  const [px, pz] = petPoint(pet.distance);
  const home = petIndoors() ? room.at : OWN_CENTRE;
  pet.group.position.set(home.x + px, GROUND_Y, home.z + pz);
  pet.group.rotation.y = pet.heading;
  // Next to your own figure in the cottage it is drawn smaller, so it sits in proportion.
  pet.group.scale.setScalar(PET_SIZE[pet.kind].scale * (petIndoors() ? PET_INDOOR_SCALE : 1));

  // Legs.
  if (rabbit) {
    pet.legs[0].rotation.z = 0.7 * air;
    pet.legs[1].rotation.z = 0.7 * air;
    pet.legs[2].rotation.z = -0.9 * air + 0.2 * crouch;
    pet.legs[3].rotation.z = -0.9 * air + 0.2 * crouch;
  } else {
    const stride = Math.sin(pet.gaitT) * gait.swing * moving;
    pet.legs[0].rotation.z = stride;
    pet.legs[3].rotation.z = stride;
    pet.legs[1].rotation.z = -stride;
    pet.legs[2].rotation.z = -stride;
  }

  // Body: breathing, a bob as it walks, the arc of a hop.
  const breath = Math.sin(now * 2.2 + (cat ? 1 : 0)) * 0.012;
  pet.body.position.y = pet.baseY + (rabbit ? air * 0.13 - crouch * 0.02 : Math.abs(Math.sin(pet.gaitT)) * 0.012 * moving);
  pet.body.rotation.z = rabbit ? pitch : Math.sin(pet.gaitT * 0.5) * 0.02 * moving;
  pet.body.scale.set(1, 1 + breath - (rabbit ? crouch * 0.1 : 0), 1);

  // Head: it looks about when still, bobs a little as it walks, and the dog pants.
  const look = still ? 0 : Math.sin(now * 0.5 + (dog ? 2 : 0)) * (moving ? 0.1 : 0.35);
  pet.neck.rotation.z = 0;
  pet.head.rotation.y = look;
  pet.head.rotation.z = Math.sin(now * 1.3) * 0.04 + (moving && !rabbit ? Math.sin(pet.gaitT) * 0.05 : 0) + (rabbit ? -pitch * 0.5 : 0);
  if (dog && pet.head.userData.tongue) pet.head.userData.tongue.visible = !still && !pet.feed && Math.sin(now * 0.4) > 0.2;

  // Ears twitch now and then.
  pet.ears.forEach((e, n) => {
    const twitch = Math.max(0, Math.sin(now * 0.9 + n * 2.3 + (rabbit ? 1 : 0))) ** 12;
    e.rotation.x = e.userData.baseX + twitch * 0.3 * e.userData.side;
    e.rotation.z = e.userData.baseZ - (rabbit ? air * 0.4 : 0);
  });
  if (pet.nose && rabbit) {
    // Twitches: scale from its own small size, not from one.
    pet.nose.userData.base ??= pet.nose.scale.clone();
    pet.nose.scale.copy(pet.nose.userData.base).multiplyScalar(1 + Math.sin(now * 16) * 0.22);
  }

  // Tail: a cat's curls and sways, a dog's wags.
  if (pet.tails.length > 0) {
    const [t0, ...rest] = pet.tails;
    t0.rotation.z = t0.userData.rest;
    t0.rotation.y = dog ? Math.sin(now * (moving ? 12 : 8)) * 0.3 : Math.sin(now * 1.4) * 0.25;
    rest.forEach((t, i) => {
      t.rotation.z = t.userData.rest + (cat ? Math.sin(now * 1.4 + i) * 0.12 : 0);
      t.rotation.y = 0;
    });
  }

  // Eyes blink for a moment every few seconds.
  const blink = Math.floor(now * 4) % 17 === 0 ? 0.12 : 1;
  for (const e of pet.eyes) e.mesh.scale.y = e.sy * blink;

  if (pet.stroke) {
    const t = now - pet.stroke.start;
    if (t >= PET_STROKE_S) {
      removePetHearts(pet.stroke.hearts);
      pet.stroke = null;
    } else {
      const settle = 1 - smooth(clamp01((t - 0.2) / 1.6));
      pet.body.scale.multiplyScalar(1 + 0.07 * Math.sin(Math.PI * clamp01(t / 0.7)));
      pet.head.rotation.z += 0.3 * settle; // leans up into the hand
      if (dog && pet.tails[0]) pet.tails[0].rotation.y += Math.sin(t * 22) * 0.5 * settle;
      if (cat && pet.tails[0]) pet.tails[0].rotation.z -= 0.35 * settle;
      if (!still) {
        if (cat) pet.body.position.y += Math.sin(t * 50) * 0.002 * settle; // a purr
        else pet.body.position.y += Math.abs(Math.sin(t * 8)) * 0.03 * settle;
      }
      for (const e of pet.ears) e.rotation.z -= 0.25 * settle * (rabbit ? -1 : 1) * (dog ? 0 : 1);
      const h = clamp01(t / PET_STROKE_S);
      const heart = pet.stroke.hearts[0];
      heart.visible = true;
      heart.position.set(pet.group.position.x + 0.25, GROUND_Y + 0.65 + h * 0.5, pet.group.position.z);
      heart.material.opacity = 1 - h * h;
    }
  }

  if (pet.feed) {
    const t = now - pet.feed.start;
    if (t >= PET_FEED_S) {
      endPetFeed();
    } else {
      const feed = pet.feed;
      const settleIn = smooth(clamp01(t / 0.5));
      feed.food.group.scale.setScalar(Math.max(0.01, settleIn));
      // Down to the dish: the front dips, the neck and head follow, and the paws tuck back.
      const eatFrom = 1.0;
      const lower = smooth(clamp01((t - 0.2) / 0.9)) * (1 - smooth(clamp01((t - PET_FEED_S + 0.7) / 0.7)));
      const eating = clamp01((t - eatFrom) / (PET_FEED_S - eatFrom - 1.0));
      const bow = rabbit ? 0.045 : cat ? 0.07 : 0.09;
      pet.body.position.y -= bow * lower;
      pet.body.rotation.z -= (rabbit ? 0.2 : 0.14) * lower;
      pet.neck.rotation.z = -0.62 * lower;
      pet.legs[0].rotation.z = -0.32 * lower;
      pet.legs[1].rotation.z = -0.32 * lower;
      // Chewing: quick small movements of the head while it has something in its mouth.
      const chewing = lower * (eating < 1 ? 1 : 0);
      const chew = rabbit ? Math.sin(now * 22) * 0.07 : dog ? Math.sin(now * 11) * 0.09 : Math.sin(now * 7) * 0.05;
      pet.head.rotation.z = -0.85 * lower + chew * chewing + (dog ? Math.max(0, Math.sin(now * 3)) ** 6 * 0.18 * chewing : 0);
      pet.head.rotation.y = cat ? Math.sin(now * 2) * 0.12 * lower : 0;
      if (rabbit && pet.nose) pet.nose.scale.copy(pet.nose.userData.base ?? pet.nose.scale).multiplyScalar(1 + Math.sin(now * 28) * 0.3);
      if (dog && pet.head.userData.tongue) pet.head.userData.tongue.visible = chewing > 0.5 && Math.sin(now * 5) > 0;
      if (dog && pet.tails[0]) pet.tails[0].rotation.y = Math.sin(now * 14) * 0.5;
      if (cat && pet.tails[0]) pet.tails[0].rotation.z -= 0.25 * lower;
      // A rabbit leans in as the carrot gets shorter.
      if (rabbit) {
        const creep = 0.15 * eating;
        pet.group.position.x += feed.forward.x * creep;
        pet.group.position.z += feed.forward.y * creep;
      } else if (cat) {
        const creep = 0.07 * eating;
        pet.group.position.x += feed.forward.x * creep;
        pet.group.position.z += feed.forward.y * creep;
      }
      // The food goes bit by bit: each piece shrinks away as its turn comes.
      const n = feed.food.pieces.length;
      feed.food.pieces.forEach((piece, i) => {
        const k = clamp01(eating * n - i);
        piece.mesh.visible = k < 1;
        if (piece.extra) piece.extra.visible = k < 1;
        if (piece.eye) piece.eye.visible = k < 1;
        if (!piece.mesh.userData.size) piece.mesh.userData.size = piece.mesh.scale.clone();
        piece.mesh.scale.copy(piece.mesh.userData.size).multiplyScalar(Math.max(0.05, 1 - k * 0.6));
      });
      const bones = feed.food.group.userData.bones;
      if (bones) {
        const done = eating > 0.7;
        feed.food.group.userData.spine.visible = done;
        bones.forEach((bone) => (bone.visible = done));
      }
      const leaves = feed.food.group.userData.leaves;
      if (leaves) for (const leaf of leaves) leaf.visible = eating < 0.97;
      // Hearts float up while it eats.
      feed.hearts.forEach((heart, n2) => {
        const h = (t - 1.5 - n2 * 1.7) / 1.6;
        heart.visible = h > 0 && h < 1;
        if (!heart.visible) return;
        heart.position.set(pet.group.position.x + 0.25, GROUND_Y + 0.65 + h * 0.5, pet.group.position.z);
        heart.material.opacity = 1 - h * h;
      });
    }
  }

  // Stand on whatever is underneath: no part of it may go below the ground at its own spot,
  // whether a paw is on a stone, a rug is under it, or its head is down at the dish. It is
  // eased, so it steps up onto a stone instead of jumping.
  pet.group.position.y = GROUND_Y + pet.lift;
  pet.group.updateMatrixWorld(true);
  let deficit = -Infinity;
  for (const mesh of pet.meshes) {
    petBox.setFromObject(mesh);
    petBox.getCenter(petPoint3);
    deficit = Math.max(deficit, petFloorAt(petPoint3.x, petPoint3.z) - petBox.min.y);
  }
  const wanted = Math.max(0, pet.lift + deficit + 0.003);
  pet.lift += (wanted - pet.lift) * Math.min(1, dt * (wanted > pet.lift ? 45 : 10));
  pet.group.position.y = GROUND_Y + pet.lift;

  // Its name floats over it, but only while you are looking at your own garden or the cottage.
  pet.tag.visible = (ownMode || petIndoors()) && !photoMode;
  pet.tag.position.set(pet.group.position.x, GROUND_Y + pet.lift + (petIndoors() ? 0.65 : 1.1), pet.group.position.z);
  pet.tag.scale.set(petIndoors() ? 0.8 : 1.0, petIndoors() ? 0.2 : 0.25, 1);
}

// A barn for the cows, out on the lawn between two of their patches, facing the garden:
// a red barn with a gambrel roof, white-trimmed double doors, a hay loft with straw
// poking out, a stack of bales and a water trough. All for show, like the cows: nobody
// can go in, nothing depends on it, and the cows' patches keep clear of it.
const BARN_AT = { x: 3.4, z: -27.5 };
const BARN_SCALE = 1.3;
const barnMat = {
  wall: flatMaterial(0xb23a2c),
  door: flatMaterial(0x8e2a20),
  trim: flatMaterial(0xf2ead8),
  roof: flatMaterial(0x5a4a42),
  stone: flatMaterial(0x8a857c),
  dark: flatMaterial(0x241c18),
  bale: flatMaterial(0xe0bb52),
  baleDark: flatMaterial(0xc29a3c),
  twine: flatMaterial(0x8a6a38),
  water: flatMaterial(0x7fb2cc),
};
// The windows and the hay loft door: dark glass by day, lamplight from dusk until dawn,
// like the cottage's. updateBarn sets the colour; the halos are set with the fireflies.
const barnGlass = new THREE.MeshBasicMaterial({ color: 0x241c18 });
const barnGlassDay = new THREE.Color(0x241c18);
const barnGlassNight = new THREE.Color(0xffc45e);
const barnGlows = [];
const barnLantern = new THREE.MeshBasicMaterial({ color: 0xfff0c4 });
const barnGroup = new THREE.Group();
{
  const g = barnGroup;
  const W = 4; // width across the front
  const D = 3.2; // depth
  const H = 2.4; // wall height
  g.add(box(W + 0.14, 0.18, D + 0.14, barnMat.stone, 0, 0.09, 0)); // stone footing
  g.add(box(W, H, D, barnMat.wall, 0, 0.18 + H / 2, 0));
  // Gambrel gable at each end: a steep lower slope and a shallow upper one.
  const profile = [[-W / 2, 0], [W / 2, 0], [1.2, 1.0], [0, 1.6], [-1.2, 1.0]];
  const gableShape = new THREE.Shape(profile.map(([x, y]) => new THREE.Vector2(x, y)));
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(gableShape, { depth: D, bevelEnabled: false }), barnMat.wall);
  gable.position.set(0, 0.18 + H, -D / 2);
  g.add(gable);
  // The roof: four slabs along the profile, pushed a little out so the walls sit under it.
  const slab = (a, b, side) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const nx = dy / len;
    const ny = -dx / len;
    const mesh = box(len + 0.12, 0.1, D + 0.4, barnMat.roof, side * ((a[0] + b[0]) / 2 + nx * 0.07), 0.18 + H + (a[1] + b[1]) / 2 + ny * 0.07, 0);
    mesh.rotation.z = Math.atan2(dy, dx * side);
    g.add(mesh);
  };
  for (const side of [1, -1]) {
    slab([W / 2, 0], [1.2, 1.0], side);
    slab([1.2, 1.0], [0, 1.6], side);
  }
  g.add(box(0.2, 0.08, D + 0.44, barnMat.trim, 0, 0.18 + H + 1.68, 0)); // ridge cap
  // Double doors in front, each with a white frame and an X.
  const front = D / 2 + 0.03;
  g.add(box(1.7, 1.75, 0.04, barnMat.dark, 0, 0.18 + 0.875, front - 0.01));
  const trimBar = (w, h, x, y, z, angle = 0) => {
    const bar = box(w, h, 0.05, barnMat.trim, x, y, z);
    bar.rotation.z = angle;
    g.add(bar);
  };
  for (const side of [-1, 1]) {
    const cx = side * 0.43;
    const cy = 0.18 + 0.875;
    g.add(box(0.8, 1.65, 0.05, barnMat.door, cx, cy, front + 0.01));
    trimBar(0.8, 0.07, cx, cy + 0.79, front + 0.04);
    trimBar(0.8, 0.07, cx, cy - 0.79, front + 0.04);
    trimBar(0.07, 1.65, cx - 0.37, cy, front + 0.04);
    trimBar(0.07, 1.65, cx + 0.37, cy, front + 0.04);
    trimBar(1.7, 0.06, cx, cy, front + 0.045, Math.atan2(1.65, 0.8) * (side > 0 ? 1 : -1));
  }
  trimBar(0.07, 1.75, 0, 0.18 + 0.875, front + 0.05);
  // The hay loft: a little door high in the front gable with straw spilling out.
  const loftY = 0.18 + H + 0.62;
  g.add(box(0.75, 0.7, 0.04, barnGlass, 0, loftY, front - 0.01));
  trimBar(0.85, 0.07, 0, loftY + 0.38, front + 0.03);
  trimBar(0.85, 0.07, 0, loftY - 0.38, front + 0.03);
  trimBar(0.07, 0.76, -0.4, loftY, front + 0.03);
  trimBar(0.07, 0.76, 0.4, loftY, front + 0.03);
  const strawLump = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), barnMat.bale);
  strawLump.scale.set(0.32, 0.18, 0.2);
  strawLump.position.set(0.05, loftY - 0.26, front + 0.1);
  g.add(strawLump);
  // A window on each side wall, white-framed.
  for (const side of [-1, 1]) {
    const x = side * (W / 2 + 0.02);
    const frame = box(0.05, 0.62, 0.62, barnMat.trim, x, 0.18 + 1.45, 0);
    g.add(frame);
    g.add(box(0.06, 0.46, 0.46, barnGlass, x + side * 0.005, 0.18 + 1.45, 0));
  }
  // A soft glow over each lit opening, drawn in front of it, only at night.
  const barnHalo = (x, y, z, size) => {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc860, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(size);
    halo.position.set(x, y, z);
    g.add(halo);
    barnGlows.push(halo);
  };
  barnHalo(0, loftY, front + 0.25, 2.1);
  for (const side of [-1, 1]) barnHalo(side * (W / 2 + 0.06), 0.18 + 1.45, 0, 0.85);
  // A lantern hanging by the doors, lit at night, so the way in is lit as well.
  const lamp = new THREE.Group();
  lamp.position.set(1.15, 0.18 + 1.75, front + 0.1);
  lamp.add(box(0.05, 0.4, 0.05, barnMat.dark, 0, 0.1, -0.05));
  lamp.add(box(0.3, 0.04, 0.04, barnMat.dark, -0.12, 0.3, -0.05));
  lamp.add(box(0.18, 0.24, 0.18, barnLantern, 0, -0.04, 0.05));
  lamp.add(box(0.22, 0.04, 0.22, barnMat.dark, 0, 0.1, 0.05));
  g.add(lamp);
  barnHalo(1.15, 0.18 + 1.7, front + 0.4, 1.5);
  // A stack of bales against the right-hand wall, and a trough on the left.
  const bale = (x, y, z, turn) => {
    const b = new THREE.Group();
    b.add(box(0.7, 0.4, 0.46, barnMat.bale, 0, 0, 0));
    for (const dx of [-0.2, 0.2]) b.add(box(0.04, 0.42, 0.48, barnMat.twine, dx, 0, 0));
    b.add(box(0.66, 0.02, 0.4, barnMat.baleDark, 0, 0.205, 0));
    b.position.set(x, y, z);
    b.rotation.y = turn;
    g.add(b);
  };
  // The bales are on the side away from the cottage, and the trough on the cottage side.
  bale(-W / 2 - 0.6, 0.38, 0.5, 0.1);
  bale(-W / 2 - 0.6, 0.38, -0.2, -0.05);
  bale(-W / 2 - 0.64, 0.8, 0.2, 0.2);
  bale(-W / 2 - 0.6, 0.38, 1.2, -0.15);
  g.add(box(1.2, 0.34, 0.45, barnMat.roof, W / 2 + 0.8, 0.17, 1.0)); // trough
  g.add(box(1.04, 0.04, 0.3, barnMat.water, W / 2 + 0.8, 0.33, 1.0));
  g.position.set(BARN_AT.x, GROUND_Y, BARN_AT.z);
  g.rotation.y = Math.atan2(GARDEN_CENTRE.x - BARN_AT.x, GARDEN_CENTRE.z - BARN_AT.z);
  g.scale.setScalar(BARN_SCALE);
  scene.add(g);
}

// Inside the barn: a room you can walk about in, far off from the garden so nothing of the
// outside shows through. It is only a way of looking, like the camera and your own garden:
// nothing is sent, stored, counted or logged, there are no gardeners' figures in here, and
// nothing in the garden depends on whether you are in it. Going in is a click on the barn or
// its sign and going out is a button, the doors or Escape, wherever your figure stands. The
// cows you give hay to in here are drawn only in your own page.
const INTERIOR_AT = { x: 400, z: 0 };
const interiorMat = (colour, glow = 0.38) =>
  new THREE.MeshStandardMaterial({ color: colour, flatShading: true, emissive: new THREE.Color(colour).multiplyScalar(glow) });
const barnIn = (() => {
  const g = new THREE.Group();
  g.position.set(INTERIOR_AT.x, GROUND_Y, INTERIOR_AT.z);
  g.visible = false;
  const m = {
    floor: interiorMat(0x8a6a48),
    floorLight: interiorMat(0x9c7b56),
    wall: interiorMat(0xa87a4e),
    batten: interiorMat(0x7a5532),
    beam: interiorMat(0x5e3f26),
    roof: interiorMat(0x8a6240),
    straw: interiorMat(0xe0bb52, 0.45),
    strawDark: interiorMat(0xc29a3c, 0.45),
    twine: interiorMat(0x8a6a38),
    rail: interiorMat(0xb98d5c),
    trough: interiorMat(0x6b4a2e),
    door: interiorMat(0x8e2a20, 0.3),
    trim: interiorMat(0xf2ead8, 0.4),
    metal: interiorMat(0x6f6f6f, 0.25),
    dark: interiorMat(0x241c18, 0.1),
  };
  m.roof.side = THREE.DoubleSide;
  // The lanterns warm the room whatever the hour outside, so the cows are never lost in the dark.
  g.add(new THREE.AmbientLight(0xffe2b8, 0.9));
  const W = 10;
  const D = 14;
  const H = 4.6; // a tall barn, so the beams and loft feel big
  // Floor: planks down the aisle, packed earth either side, and loose straw in the stalls.
  g.add(box(W, 0.2, D, m.floor, 0, -0.1, 0));
  for (let i = 0; i < 9; i++) g.add(box(0.46, 0.02, D - 0.1, i % 2 ? m.floor : m.floorLight, -2.1 + i * 0.52, 0.01, 0));
  for (let k = 0; k < 18; k++) {
    const side = k % 2 ? 1 : -1;
    const lump = box(0.5 + seeded(k * 3 + 1) * 0.7, 0.025, 0.4 + seeded(k * 3 + 2) * 0.6, k % 3 ? m.straw : m.strawDark, side * (3.0 + seeded(k + 9) * 1.8), 0.02, -3.6 + seeded(k + 21) * 8.4);
    lump.rotation.y = seeded(k + 40) * 3;
    g.add(lump);
  }
  // Walls with a batten every so often, and the roof's gambrel above them.
  g.add(box(0.2, H, D, m.wall, -W / 2 - 0.1, H / 2, 0));
  g.add(box(0.2, H, D, m.wall, W / 2 + 0.1, H / 2, 0));
  g.add(box(W + 0.4, H, 0.2, m.wall, 0, H / 2, -D / 2 - 0.1));
  for (let z = -6.5; z <= 6.6; z += 1.3) {
    g.add(box(0.07, H, 0.12, m.batten, -W / 2 + 0.03, H / 2, z));
    g.add(box(0.07, H, 0.12, m.batten, W / 2 - 0.03, H / 2, z));
  }
  for (let x = -4.5; x <= 4.6; x += 1.5) g.add(box(0.12, H, 0.07, m.batten, x, H / 2, -D / 2 + 0.03));
  // The front wall has a double door, which is the way out.
  g.add(box(3.8, H, 0.2, m.wall, -3.3, H / 2, D / 2 + 0.1));
  g.add(box(3.8, H, 0.2, m.wall, 3.3, H / 2, D / 2 + 0.1));
  g.add(box(2.8, H - 2.6, 0.2, m.wall, 0, 2.6 + (H - 2.6) / 2, D / 2 + 0.1));
  const doors = [];
  for (const side of [-1, 1]) {
    const leaf = box(1.4, 2.6, 0.1, m.door, side * 0.7, 1.3, D / 2 + 0.02);
    doors.push(leaf);
    g.add(leaf);
    for (const [w, h, x, y, a] of [[1.4, 0.07, 0, 0.1, 0], [1.4, 0.07, 0, 2.5, 0], [0.07, 2.6, -0.65, 1.3, 0], [0.07, 2.6, 0.65, 1.3, 0], [3.0, 0.06, 0, 1.3, Math.atan2(2.6, 1.4) * (side > 0 ? 1 : -1)]]) {
      const bar = box(w, h, 0.04, m.trim, side * 0.7 + x, y, D / 2 - 0.04);
      bar.rotation.z = a;
      doors.push(bar);
      g.add(bar);
    }
  }
  // Roof slabs, the two gable ends and tie beams across.
  const slab = (a, b, side) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const mesh = box(Math.hypot(dx, dy) + 0.15, 0.1, D + 0.4, m.roof, side * ((a[0] + b[0]) / 2), H + (a[1] + b[1]) / 2, 0);
    mesh.rotation.z = Math.atan2(dy, dx * side);
    g.add(mesh);
  };
  for (const side of [1, -1]) {
    slab([W / 2 + 0.2, 0], [3.4, 1.5], side);
    slab([3.4, 1.5], [0, 2.4], side);
  }
  const gable = new THREE.Shape([[-W / 2 - 0.2, 0], [W / 2 + 0.2, 0], [3.4, 1.5], [0, 2.4], [-3.4, 1.5]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (const z of [-D / 2, D / 2]) {
    const end = new THREE.Mesh(new THREE.ShapeGeometry(gable), m.wall);
    end.material = interiorMat(0xa87a4e);
    end.material.side = THREE.DoubleSide;
    end.position.set(0, H, z);
    g.add(end);
  }
  for (let z = -6; z <= 6; z += 3) g.add(box(W + 0.3, 0.22, 0.26, m.beam, 0, H - 0.1, z));
  for (const side of [-1, 1]) for (let z = -6; z <= 6; z += 3) {
    const brace = box(1.5, 0.14, 0.16, m.beam, side * 4.2, H - 0.55, z);
    brace.rotation.z = side * 0.75;
    g.add(brace);
  }
  // The hay loft across the back, on posts, with a ladder, a rail and hay spilling over.
  const LOFT_Z = -D / 2 + 1.5;
  g.add(box(W, 0.15, 3.0, m.floor, 0, 2.45, LOFT_Z));
  for (const x of [-4.8, -2.4, 0, 2.4, 4.8]) g.add(box(0.18, 2.45, 0.18, m.beam, x, 1.22, -4.1));
  g.add(box(W, 0.09, 0.07, m.rail, 0, 3.0, -4.1));
  for (let x = -4.8; x <= 4.9; x += 1.2) g.add(box(0.05, 0.55, 0.05, m.rail, x, 2.75, -4.1));
  for (const x of [-4.4, -3.9]) {
    const rail = box(0.07, 2.7, 0.07, m.rail, x, 1.3, -4.45);
    rail.rotation.x = -0.12;
    g.add(rail);
  }
  for (let y = 0.3; y < 2.4; y += 0.34) g.add(box(0.5, 0.05, 0.06, m.rail, -4.15, y, -4.4 - y * 0.12));
  const spill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), m.straw);
  for (let k = 0; k < 7; k++) {
    const lump = spill.clone();
    lump.scale.set(0.5 + seeded(k + 60) * 0.4, 0.22 + seeded(k + 70) * 0.2, 0.4);
    lump.position.set(-3 + k * 1.05 + seeded(k + 80) * 0.3, 2.62, -3.95);
    g.add(lump);
  }
  const inBale = (x, y, z, turn = 0) => {
    const b = new THREE.Group();
    b.add(box(0.8, 0.45, 0.5, m.straw, 0, 0, 0));
    for (const dx of [-0.24, 0.24]) b.add(box(0.04, 0.47, 0.52, m.twine, dx, 0, 0));
    b.add(box(0.74, 0.02, 0.44, m.strawDark, 0, 0.23, 0));
    b.position.set(x, y, z);
    b.rotation.y = turn;
    g.add(b);
  };
  inBale(-2.5, 2.8, -6.2);
  inBale(-1.6, 2.8, -6.3, 0.1);
  inBale(-2.1, 3.25, -6.2, -0.1);
  inBale(3.4, 2.8, -6.0, 0.2);
  inBale(2.5, 2.8, -6.4);
  // Stalls down each side, facing the aisle: partitions, rails, troughs and hay.
  const edges = [-4.0, -1.0, 2.0, 5.0];
  for (const side of [-1, 1]) {
    for (const z of edges) {
      g.add(box(2.6, 1.2, 0.1, m.rail, side * 3.7, 0.6, z));
      g.add(box(0.12, 1.25, 0.12, m.beam, side * 2.4, 0.62, z));
    }
    for (let i = 0; i < 3; i++) {
      const zc = (edges[i] + edges[i + 1]) / 2;
      g.add(box(0.07, 0.07, 2.9, m.rail, side * 2.4, 0.55, zc));
      g.add(box(0.07, 0.07, 2.9, m.rail, side * 2.4, 1.05, zc));
      g.add(box(0.5, 0.34, 2.0, m.trough, side * 2.8, 0.17, zc));
      g.add(box(0.4, 0.06, 1.8, m.straw, side * 2.8, 0.36, zc));
    }
  }
  inBale(-3.6, 0.23, 3.5, 0.3); // the empty stall: a bale and some loose hay
  inBale(-3.6, 0.23, 4.3, -0.2);
  inBale(-3.9, 0.7, 3.9, 0.1);
  inBale(3.8, 0.23, -2.9, 0.2);
  inBale(4.2, 0.23, -2.0, -0.3);
  inBale(4.0, 0.7, -2.5, 0.1);
  // Feed bins and barrels by the door, tools on the back wall.
  for (const [x, z] of [[-4.3, 6.35], [-3.2, 6.45]]) {
    g.add(box(1.0, 0.9, 0.75, m.trough, x, 0.45, z));
    g.add(box(1.06, 0.07, 0.8, m.rail, x, 0.92, z));
  }
  for (const [x, z] of [[4.4, 6.2], [4.45, 5.55], [3.75, 6.35]]) {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.9, 10), m.trough);
    barrel.position.set(x, 0.45, z);
    g.add(barrel);
    for (const y of [0.2, 0.7]) {
      const hoop = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.05, 10), m.metal);
      hoop.position.set(x, y, z);
      g.add(hoop);
    }
  }
  g.add(box(0.07, 1.6, 0.07, m.rail, 1.6, 1.5, -D / 2 + 0.1));
  for (const dx of [-0.12, 0, 0.12]) g.add(box(0.03, 0.4, 0.03, m.metal, 1.6 + dx, 0.55, -D / 2 + 0.1));
  g.add(box(0.36, 0.03, 0.03, m.metal, 1.6, 0.74, -D / 2 + 0.1));
  g.add(box(0.07, 1.4, 0.07, m.rail, 0.9, 1.5, -D / 2 + 0.1).rotateZ(0.05));
  g.add(box(0.45, 0.04, 0.05, m.metal, 0.9, 0.78, -D / 2 + 0.1));
  // Windows in the side walls, with a slanting shaft of light by day.
  const glass = new THREE.MeshBasicMaterial({ color: 0xcfe8f5 });
  const glassDay = new THREE.Color(0xcfe8f5);
  const glassNight = new THREE.Color(0x1d2744);
  const shafts = [];
  for (const side of [-1, 1]) {
    for (const z of [-1.0, 3.5]) {
      g.add(box(0.06, 0.95, 0.95, m.trim, side * (W / 2 - 0.02), 2.0, z));
      g.add(box(0.07, 0.75, 0.75, glass, side * (W / 2 - 0.03), 2.0, z));
      g.add(box(0.08, 0.06, 0.95, m.trim, side * (W / 2 - 0.05), 2.0, z));
      const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.8, 0.7), shaftMat);
      shaft.position.set(side * 3.6, 1.0, z);
      shaft.rotation.z = side * -0.62;
      g.add(shaft);
      shafts.push(shaftMat);
    }
  }
  // Lanterns hung from the beams, brighter as it gets dark.
  const halos = [];
  const hang = (x, y, z) => {
    g.add(box(0.02, H - y - 0.1, 0.02, m.dark, x, (H + y) / 2 - 0.05, z));
    g.add(box(0.2, 0.26, 0.2, barnLantern, x, y, z));
    g.add(box(0.26, 0.04, 0.26, m.dark, x, y + 0.15, z));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc860, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(2.4);
    halo.position.set(x, y, z);
    g.add(halo);
    halos.push(halo);
  };
  hang(0, 2.55, -3);
  hang(0, 2.55, 1.5);
  hang(0, 2.55, 5.5);
  // Four cows, two each side, looking at the aisle. They are drawn here and nowhere else.
  // Far enough back that the nose stops short of the rail along the aisle.
  const cowSpots = [[-4.05, -2.5, 0, 0], [-4.05, 0.5, 0, 1], [4.05, 0.5, Math.PI, 2], [4.05, 3.5, Math.PI, 4]];
  const stalledCows = cowSpots.map(([x, z, turn, index]) => {
    const cow = buildCow(index);
    cow.group.position.set(x, 0, z);
    cow.group.rotation.y = turn;
    cow.index = index;
    cow.feed = null;
    g.add(cow.group);
    return cow;
  });
  scene.add(g);
  const obstacles = [[-5.3, -2.25, -4.1, 5.1], [2.25, 5.3, -4.1, 5.1], [-5.3, -2.9, 5.9, 7.3], [3.3, 5.3, 5.2, 7.3]];
  return {
    id: "barn",
    group: g,
    at: INTERIOR_AT,
    start: { x: 0, z: 3.8 },
    bounds: { x0: -4.65, x1: 4.65, z0: -6.65, z1: 6.65 },
    cows: stalledCows,
    doors,
    glass,
    glassDay,
    glassNight,
    shafts,
    halos,
    obstacles,
    pet: false,
    follow: { back: 3.1, up: 1.2 },
    title: "The barn",
    note: "Only you can see in here. Walk with W A S D, turn with the arrow keys or by dragging, and click a cow to give it hay.",
    welcome: "Inside the barn. Only you can see in here.",
    doorHint: "Click the doors to go back outside",
  };
})();

const interiorBar = document.getElementById("interior-bar");
const interiorFade = document.getElementById("interior-fade");
const interiorStick = document.getElementById("interior-stick");
const interiorKnob = document.getElementById("interior-knob");
const interiorTitle = document.getElementById("interior-title");
const interiorNote = document.getElementById("interior-note");
const interiorFeed = document.getElementById("interior-feed");
let interiorMode = false;
let interiorBusy = false;
let interiorReturn = null;
let room = null; // the room you are in: barnIn or cottageIn
const walker = { x: 0, z: 5.5, yaw: 0, pitch: 0, bob: 0, vf: 0, vs: 0, gait: 0, last: 0 };
const walkKeys = new Set();
const stick = { x: 0, y: 0, id: null };
const INTERIOR_FOV = 60;
// You are seen from behind and a little above, as a small figure in your own colour, like the
// one outside but drawn only here and only for you. The camera follows it round the room.
const FOLLOW_LOOK = 1.0;
let roomFigure = null;
function buildRoomFigure() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(FIGURE_BODY, flatMaterial(colourFor(me ?? "00000000")));
  body.position.y = 0.21;
  const head = new THREE.Mesh(FIGURE_HEAD, baseSkinMaterial);
  head.position.y = 0.54;
  const brim = new THREE.Mesh(FIGURE_BRIM, baseStrawMaterial);
  brim.position.y = 0.64;
  const crown = new THREE.Mesh(FIGURE_CROWN, baseStrawMaterial);
  crown.position.y = 0.7;
  const shadow = new THREE.Mesh(FIGURE_SHADOW, baseShadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  group.add(body, head, brim, crown, shadow);
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, 0.4, 0);
    pivot.rotation.z = side * ARM_REST;
    const sleeve = new THREE.Mesh(FIGURE_ARM, body.material);
    const hand = new THREE.Mesh(FIGURE_HAND, baseSkinMaterial);
    hand.position.y = -0.24;
    pivot.add(sleeve, hand);
    group.add(pivot);
    return pivot;
  });
  group.scale.setScalar(1.15);
  return { group, body, arms };
}

function barnUnderPointer() {
  const hit = raycaster.intersectObject(barnGroup, true)[0];
  return hit ? { distance: hit.distance } : null;
}

function cottageUnderPointer() {
  const hit = raycaster.intersectObject(cottageGroup, true)[0];
  return hit ? { distance: hit.distance } : null;
}

function enterRoom(target) {
  if (interiorMode || interiorBusy || photoMode || ownMode) return;
  interiorBusy = true;
  closePlotChoice();
  closeBag();
  clearHoveredPlot();
  setHoveredBed(null);
  clearStatusBarHover();
  interiorFade.classList.add("on");
  setTimeout(() => {
    interiorReturn = {
      target: (glide ? glide.toTarget : controls.target).clone(),
      camera: (glide ? glide.toCamera : camera.position).clone(),
      fov: camera.fov,
    };
    glide = null;
    room = target;
    interiorMode = true;
    document.body.classList.add("interior-mode");
    interiorTitle.textContent = room.title;
    interiorNote.textContent = room.note;
    interiorBar.hidden = false;
    interiorStick.hidden = !window.matchMedia("(pointer: coarse)").matches;
    room.group.visible = true;
    if (roomFigure) {
      roomFigure.group.parent?.remove(roomFigure.group);
      roomFigure.body.material.dispose();
    }
    roomFigure = buildRoomFigure();
    room.group.add(roomFigure.group);
    controls.enabled = false;
    camera.fov = INTERIOR_FOV;
    camera.updateProjectionMatrix();
    Object.assign(walker, { x: room.start.x, z: room.start.z, yaw: 0, pitch: 0, bob: 0, vf: 0, vs: 0, gait: 0, last: performance.now() });
    statusBar.textContent = room.welcome;
    interiorFade.classList.remove("on");
    setTimeout(() => (interiorBusy = false), 260);
  }, 260);
}
const enterBarn = () => enterRoom(barnIn);
const enterCottage = () => enterRoom(cottageIn);

function leaveRoom() {
  if (!interiorMode || interiorBusy) return;
  interiorBusy = true;
  interiorFade.classList.add("on");
  setTimeout(() => {
    interiorMode = false;
    walkKeys.clear();
    stick.x = stick.y = 0;
    interiorKnob.style.transform = "";
    document.body.classList.remove("interior-mode");
    interiorBar.hidden = true;
    interiorStick.hidden = true;
    room.group.remove(roomFigure.group);
    roomFigure.body.material.dispose();
    roomFigure = null;
    room.group.visible = false;
    room = null;
    camera.fov = interiorReturn.fov;
    camera.updateProjectionMatrix();
    camera.position.copy(interiorReturn.camera);
    controls.target.copy(interiorReturn.target);
    controls.enabled = true;
    controls.update();
    renderer.domElement.style.cursor = "";
    clearStatusBarHover();
    interiorFade.classList.remove("on");
    setTimeout(() => (interiorBusy = false), 260);
  }, 260);
}

function blockedInRoom(x, z) {
  const b = room.bounds;
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return true;
  // Your pet is in the way too, but if it has walked into you, you can still step away.
  if (petIndoors() && petObj?.group) {
    const px = petObj.group.position.x - room.at.x;
    const pz = petObj.group.position.z - room.at.z;
    const now = Math.hypot(walker.x - px, walker.z - pz);
    const next = Math.hypot(x - px, z - pz);
    if (next < PET_KEEP_OUT && next < now) return true;
  }
  const r = 0.3;
  return room.obstacles.some(([x0, x1, z0, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
}

function updateInterior(now) {
  const dt = Math.min((now - walker.last) / 1000, 0.1);
  walker.last = now;
  const turn = (walkKeys.has("ArrowLeft") || walkKeys.has("KeyQ") ? 1 : 0) - (walkKeys.has("ArrowRight") || walkKeys.has("KeyE") ? 1 : 0);
  walker.yaw += turn * 1.8 * dt;
  let fwd = (walkKeys.has("KeyW") || walkKeys.has("ArrowUp") ? 1 : 0) - (walkKeys.has("KeyS") || walkKeys.has("ArrowDown") ? 1 : 0) + stick.y;
  let side = (walkKeys.has("KeyD") ? 1 : 0) - (walkKeys.has("KeyA") ? 1 : 0) + stick.x;
  const len = Math.hypot(fwd, side);
  if (len > 1) {
    fwd /= len;
    side /= len;
  }
  // Speed eases up and down instead of jumping, and the stride grows with it, so setting off
  // starts with a step rather than a slide.
  const want = !interiorBusy || interiorMode ? 1 : 0;
  const ease = 1 - Math.exp(-dt * 9);
  walker.vf += (fwd * want - walker.vf) * ease;
  walker.vs += (side * want - walker.vs) * ease;
  const pace = Math.hypot(walker.vf, walker.vs);
  walker.gait += (Math.min(1, pace * 1.6) - walker.gait) * (1 - Math.exp(-dt * 14));
  {
    const speed = 2.4;
    const dx = (-Math.sin(walker.yaw) * walker.vf + Math.cos(walker.yaw) * walker.vs) * speed * dt;
    const dz = (-Math.cos(walker.yaw) * walker.vf - Math.sin(walker.yaw) * walker.vs) * speed * dt;
    if (!blockedInRoom(walker.x + dx, walker.z)) walker.x += dx;
    if (!blockedInRoom(walker.x, walker.z + dz)) walker.z += dz;
    walker.bob += dt * (3 + 6 * Math.min(1, pace));
  }
  // Your figure walks about the room, turned the way it is going, with a little bounce and
  // swing of its arms.
  const f = roomFigure;
  const step = Math.sin(walker.bob) * walker.gait;
  f.group.position.set(walker.x, Math.abs(step) * 0.05 + (petIndoors() ? petFloorAt(room.at.x + walker.x, room.at.z + walker.z) - GROUND_Y : 0), walker.z);
  f.group.rotation.y = walker.yaw + Math.PI;
  f.body.rotation.z = step * 0.08;
  f.arms[0].rotation.z = -ARM_REST - step * 0.35;
  f.arms[1].rotation.z = ARM_REST - step * 0.35;

  // The camera stays behind and above you, looking at you, and never goes through a wall: if
  // the room is in the way it comes in closer.
  const behind = new THREE.Vector3(Math.sin(walker.yaw), 0, Math.cos(walker.yaw));
  let back = room.follow.back * Math.cos(Math.max(walker.pitch, -0.3) * 0.5);
  for (let k = 0; k < 12; k++) {
    const cx = walker.x + behind.x * back;
    const cz = walker.z + behind.z * back;
    const b = room.bounds;
    const inside = cx > b.x0 - 0.15 && cx < b.x1 + 0.15 && cz > b.z0 - 0.15 && cz < b.z1 + 0.15;
    const inFurniture = room.obstacles.some(([x0, x1, z0, z1]) => cx > x0 - 0.2 && cx < x1 + 0.2 && cz > z0 - 0.2 && cz < z1 + 0.2);
    if (inside && !inFurniture) break;
    back *= 0.85;
  }
  const lift = room.follow.up + walker.pitch * 1.2;
  camera.position.set(room.at.x + walker.x + behind.x * back, GROUND_Y + Math.max(0.5, lift), room.at.z + walker.z + behind.z * back);
  camera.lookAt(room.at.x + walker.x, GROUND_Y + FOLLOW_LOOK, room.at.z + walker.z);

  interiorFeed.hidden = !(room.pet && petObj);
  room.update(now);
}

barnIn.update = (now) => {
  // The light: windows and shafts follow the sky, the lanterns the dark.
  barnIn.glass.color.copy(barnIn.glassNight).lerp(barnIn.glassDay, dayness);
  const sun = dayness * (1 - 0.8 * weatherNow.cloud);
  for (const shaft of barnIn.shafts) shaft.opacity = sun * 0.13;
  for (const halo of barnIn.halos) halo.material.opacity = 0.3 + 0.5 * skyNight;

  // The cows breathe and swish a tail; one that has been given hay lowers its head to eat.
  const t = now / 1000;
  for (const cow of barnIn.cows) {
    cow.group.scale.y = 1.15 * (1 + Math.sin(t * 1.3 + cow.index) * 0.008);
    cow.tail.rotation.z = Math.sin(t * 1.7 + cow.index * 2) * 0.12;
    if (cow.feed) updateStallFeeding(cow, t);
    else cow.head.rotation.z = 0.08 + Math.sin(t * 0.8 + cow.index) * 0.03;
  }
};

const STALL_EAT_S = 4;
function feedStalledCow(cow) {
  if (cow.feed) return;
  // The cows in the barn are the garden's cows, in order, so a hand of hay counts the same.
  tellAnimal("cow", cow.index);
  const forward = new THREE.Vector3(Math.cos(cow.group.rotation.y), 0, -Math.sin(cow.group.rotation.y));
  const tuft = new THREE.Group();
  for (let k = 0; k < 6; k++) {
    const lump = new THREE.Mesh(tuftGeometry, hayMaterial);
    lump.scale.set(0.12 + seeded(k + 3) * 0.06, 0.05, 0.1);
    lump.position.set((seeded(k + 8) - 0.5) * 0.3, 0.04 + k * 0.01, (seeded(k + 14) - 0.5) * 0.3);
    lump.rotation.y = seeded(k + 20) * 3;
    tuft.add(lump);
  }
  tuft.position.set(cow.group.position.x + forward.x * 1.15, 0.4, cow.group.position.z + forward.z * 1.15);
  barnIn.group.add(tuft);
  const hearts = [0, 1, 2].map(() => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: getHeartTexture(), transparent: true, depthWrite: false }));
    sprite.scale.set(0.3, 0.3, 1);
    sprite.visible = false;
    barnIn.group.add(sprite);
    return sprite;
  });
  cow.feed = { start: performance.now() / 1000, tuft, hearts, forward };
  showStatusMessage("You gave the cow some hay");
}

function updateStallFeeding(cow, t) {
  const f = cow.feed;
  const age = t - f.start;
  if (age >= STALL_EAT_S + 0.8) {
    barnIn.group.remove(f.tuft);
    for (const heart of f.hearts) {
      barnIn.group.remove(heart);
      heart.material.dispose();
    }
    cow.feed = null;
    return;
  }
  const lower = smooth(clamp01(age / 0.6)) * (1 - smooth(clamp01((age - STALL_EAT_S) / 0.8)));
  cow.head.rotation.z = 0.08 - 0.9 * lower + Math.sin(t * 7) * 0.06 * lower;
  const eaten = clamp01((age - 0.6) / (STALL_EAT_S - 0.6));
  f.tuft.scale.setScalar(Math.max(1 - eaten, 0.001));
  f.tuft.visible = eaten < 1;
  f.hearts.forEach((heart, i) => {
    const k = (age - 0.8 - i * 0.5) / 1.8;
    heart.visible = k > 0 && k < 1;
    if (!heart.visible) return;
    heart.position.set(cow.group.position.x + f.forward.x * 0.8 + (i - 1) * 0.2, 1.5 + k * 0.7, cow.group.position.z + f.forward.z * 0.8);
    heart.material.opacity = 1 - k * k;
  });
}

function stalledCowUnderPointer() {
  const hit = raycaster.intersectObjects(barnIn.cows.map((c) => c.group), true)[0];
  if (!hit) return null;
  const cow = barnIn.cows.find((c) => {
    for (let o = hit.object; o; o = o.parent) if (o === c.group) return true;
    return false;
  });
  return cow ? { cow, distance: hit.distance } : null;
}

barnIn.pick = () => {
  const cow = stalledCowUnderPointer();
  return cow ? { distance: cow.distance, label: "Click to give the cow some hay", act: () => feedStalledCow(cow.cow) } : null;
};

// A click in a room: the door takes you out, what is in front of you gets its care, and
// nothing else happens.
function interiorClick(event) {
  raycaster.setFromCamera(ndcFromEvent(event), camera);
  const pick = room.pick();
  const door = raycaster.intersectObjects(room.doors, false)[0];
  if (door && (!pick || door.distance < pick.distance)) {
    leaveRoom();
    return;
  }
  if (pick) pick.act();
}

function interiorPointerMove(event) {
  if (interiorLook && event.buttons & 1) {
    walker.yaw -= (event.clientX - interiorLook.x) * 0.005;
    walker.pitch = Math.max(-0.4, Math.min(0.8, walker.pitch + (event.clientY - interiorLook.y) * 0.004));
    interiorLook = { x: event.clientX, y: event.clientY };
    return;
  }
  raycaster.setFromCamera(ndcFromEvent(event), camera);
  const pick = room.pick();
  const door = raycaster.intersectObjects(room.doors, false)[0];
  const atDoor = door && (!pick || door.distance < pick.distance);
  renderer.domElement.style.cursor = pick || door ? "pointer" : "";
  statusBar.textContent = atDoor ? room.doorHint : pick ? pick.label : room.welcome;
}

let interiorLook = null;
renderer.domElement.addEventListener("pointerdown", (event) => {
  if (interiorMode) interiorLook = { x: event.clientX, y: event.clientY };
});
window.addEventListener("pointerup", () => (interiorLook = null));

document.addEventListener("keydown", (event) => {
  if (!interiorMode || photoMode || event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "Escape") {
    leaveRoom();
    return;
  }
  if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    walkKeys.add(event.code);
    event.preventDefault();
  }
});
document.addEventListener("keyup", (event) => walkKeys.delete(event.code));
window.addEventListener("blur", () => walkKeys.clear());
document.getElementById("interior-back").addEventListener("click", leaveRoom);
document.getElementById("barn-sign").addEventListener("click", enterBarn);
document.getElementById("cottage-sign").addEventListener("click", enterCottage);
interiorFeed.addEventListener("click", feedPet);

// The stick for a touch screen: how far it is pushed is how fast you walk.
function moveStick(event) {
  const rect = interiorStick.getBoundingClientRect();
  const r = rect.width / 2;
  let dx = event.clientX - (rect.left + r);
  let dy = event.clientY - (rect.top + r);
  const d = Math.hypot(dx, dy);
  if (d > r) {
    dx = (dx / d) * r;
    dy = (dy / d) * r;
  }
  stick.x = dx / r;
  stick.y = -dy / r;
  interiorKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}
interiorStick.addEventListener("pointerdown", (event) => {
  stick.id = event.pointerId;
  interiorStick.setPointerCapture(event.pointerId);
  moveStick(event);
});
interiorStick.addEventListener("pointermove", (event) => {
  if (stick.id === event.pointerId) moveStick(event);
});
const endStick = (event) => {
  if (stick.id !== event.pointerId) return;
  stick.id = null;
  stick.x = stick.y = 0;
  interiorKnob.style.transform = "";
};
interiorStick.addEventListener("pointerup", endStick);
interiorStick.addEventListener("pointercancel", endStick);

// The signs over the barn and the cottage follow them on screen, as the others do.
const roomSigns = [
  { el: document.getElementById("barn-sign"), at: () => BARN_AT, y: 5.4 },
  { el: document.getElementById("cottage-sign"), at: () => COTTAGE_AT, y: 5.6 },
];
const roomSignPoint = new THREE.Vector3();
function updateRoomSigns() {
  const rect = renderer.domElement.getBoundingClientRect();
  for (const sign of roomSigns) {
    const at = sign.at();
    roomSignPoint.set(at.x, sign.y, at.z).project(camera);
    const x = rect.left + ((roomSignPoint.x + 1) / 2) * rect.width;
    let y = rect.top + ((1 - roomSignPoint.y) / 2) * rect.height;
    const visible = !ownMode && !interiorMode && !glide && !photoMode && roomSignPoint.z < 1 && x > rect.left && x < rect.right && y > rect.top && y < rect.bottom;
    if (sign.el.hidden === visible) sign.el.hidden = !visible;
    if (!visible) continue;
    sign.el.style.left = `${x}px`;
    sign.el.style.top = `${y}px`;
  }
}

// Inside the cottage: one cosy room, far off from the garden like the barn's. It is a private
// view in the same way: nothing is sent, stored, counted or logged, there are no gardeners'
// figures in it, and nothing in the garden depends on being inside. If you have a pet, it is
// here with you (the same pet, drawn in your own page), and you can stroke it or feed it.
const COTTAGE_IN_AT = { x: 400, z: 400 };
const cottageIn = (() => {
  const g = new THREE.Group();
  g.position.set(COTTAGE_IN_AT.x, GROUND_Y, COTTAGE_IN_AT.z);
  g.visible = false;
  const m = {
    floor: interiorMat(0x9a7448),
    floorLight: interiorMat(0xa98255),
    wall: interiorMat(0xfdf1dc, 0.5),
    stone: interiorMat(0xb8a999, 0.4),
    stoneDark: interiorMat(0x7d7066, 0.3),
    wood: interiorMat(0x7a5230),
    woodLight: interiorMat(0xa87a4e),
    beam: interiorMat(0x5e3f26),
    thatch: interiorMat(0xc99a45, 0.5),
    thatchDark: interiorMat(0xb8873a, 0.5),
    door: interiorMat(0x5fb0a4, 0.4),
    trim: interiorMat(0xfffaf0, 0.5),
    gold: interiorMat(0xf2c14e, 0.6),
    pink: interiorMat(0xec8fab, 0.5),
    mint: interiorMat(0x93d4b8, 0.5),
    cream: interiorMat(0xf6e7c8, 0.5),
    blue: interiorMat(0x7aa6d6, 0.5),
    red: interiorMat(0xd9534f, 0.5),
    yellow: interiorMat(0xf2c94c, 0.5),
    leaf: interiorMat(0x4f8a46, 0.5),
    dark: interiorMat(0x241c18, 0.1),
    clay: interiorMat(0xc8744a, 0.4),
    fireBase: new THREE.MeshBasicMaterial({ color: 0xff8a2a }),
    fireTip: new THREE.MeshBasicMaterial({ color: 0xffd860 }),
    ember: new THREE.MeshBasicMaterial({ color: 0xc23b14 }),
  };
  m.thatch.side = m.thatchDark.side = THREE.DoubleSide;
  g.add(new THREE.AmbientLight(0xffe2b8, 0.9));
  const W = 4.4; // half the width
  const D = 3.4; // half the depth
  const H = 3.2; // wall height, high enough to feel airy
  const RIDGE = 1.1;
  const place = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  const cyl = (rt, rb, h, material, x, y, z, seg = 14) => place(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material), x, y, z);
  const ball = (rx, ry, rz, material, x, y, z) => place(cowBlob(rx, ry, rz, material), x, y, z);

  // Floor, in boards, and a round rug of three rings.
  g.add(box(W * 2, 0.2, D * 2, m.floor, 0, -0.1, 0));
  const boards = 16;
  for (let i = 0; i < boards; i++) g.add(box((W * 2) / boards - 0.02, 0.02, D * 2 - 0.1, i % 2 ? m.floor : m.floorLight, -W + (W / boards) + i * ((W * 2) / boards), 0.01, 0));
  cyl(1.6, 1.6, 0.025, m.cream, 0, 0.02, 0.3, 28);
  cyl(1.35, 1.35, 0.03, m.pink, 0, 0.025, 0.3, 28);
  cyl(0.95, 0.95, 0.035, m.cream, 0, 0.03, 0.3, 28);
  cyl(0.6, 0.6, 0.04, m.mint, 0, 0.035, 0.3, 28);

  // Walls, thickened outwards, and a gable above the front and the back.
  g.add(box(0.2, H, D * 2, m.wall, -W - 0.1, H / 2, 0));
  g.add(box(0.2, H, D * 2, m.wall, W + 0.1, H / 2, 0));
  g.add(box(W * 2 + 0.4, H, 0.2, m.wall, 0, H / 2, -D - 0.1));
  const front = (w, h, x, y) => g.add(box(w, h, 0.2, m.wall, x, y, D + 0.1));
  front(W - 0.55, H, -(W + 0.55) / 2, H / 2);
  front(W - 0.55, H, (W + 0.55) / 2, H / 2);
  front(1.1, H - 1.9, 0, 1.9 + (H - 1.9) / 2);
  const gable = new THREE.Shape([new THREE.Vector2(-W - 0.2, 0), new THREE.Vector2(W + 0.2, 0), new THREE.Vector2(0, RIDGE)]);
  for (const z of [-D, D]) {
    const end = new THREE.Mesh(new THREE.ShapeGeometry(gable), interiorMat(0xfdf1dc, 0.5));
    end.material.side = THREE.DoubleSide;
    place(end, 0, H, z);
  }
  // A baseboard and a stripe of wainscot round the walls.
  for (const side of [-1, 1]) {
    g.add(box(0.05, 0.14, D * 2, m.woodLight, side * (W - 0.02), 0.07, 0));
    g.add(box(0.06, 0.05, D * 2, m.woodLight, side * (W - 0.02), 0.95, 0));
  }
  g.add(box(W * 2, 0.14, 0.05, m.woodLight, 0, 0.07, -D + 0.02));
  g.add(box(W * 2, 0.05, 0.06, m.woodLight, 0, 0.95, -D + 0.02));

  // The thatch seen from underneath, with beams across.
  // Each half rises from the eave to the ridge; they overlap at the top and overhang the
  // walls, and a plain dark shell round the whole room means no sky shows at any edge.
  for (const side of [1, -1]) {
    const run = W + 0.5;
    const len = Math.hypot(run, RIDGE) + 0.4;
    const slab = box(len, 0.2, D * 2 + 0.6, side > 0 ? m.thatch : m.thatchDark, side * (run / 2), H + RIDGE / 2 - 0.02, 0);
    slab.rotation.z = -side * Math.atan2(RIDGE, run);
    g.add(slab);
  }
  const shell = new THREE.Mesh(new THREE.BoxGeometry(W * 2 + 1.6, H + RIDGE + 1.2, D * 2 + 1.6), new THREE.MeshBasicMaterial({ color: 0x3a2a1c, side: THREE.BackSide }));
  shell.position.set(0, (H + RIDGE + 1.2) / 2 - 0.4, 0);
  g.add(shell);
  for (const z of [-D + 0.9, 0, D - 0.9]) {
    g.add(box(W * 2 + 0.2, 0.18, 0.2, m.beam, 0, H - 0.05, z));
    for (const side of [-1, 1]) {
      const brace = box(0.9, 0.1, 0.12, m.beam, side * (W - 0.65), H - 0.4, z);
      brace.rotation.z = side * 0.8;
      g.add(brace);
    }
  }
  g.add(box(0.18, 0.18, D * 2, m.beam, 0, H + RIDGE - 0.12, 0));
  // Herbs and onions hung from the middle beam.
  for (let k = 0; k < 6; k++) {
    const x = -1.2 + k * 0.48;
    g.add(box(0.015, 0.34, 0.015, m.dark, x, H - 0.3, 0));
    ball(0.07, 0.1, 0.07, k % 2 ? m.leaf : m.clay, x, H - 0.52, 0);
  }

  // The door: round at the top, with a golden knob. It is the way out.
  const doors = [];
  const leaf = place(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.4, 0.08), m.door), 0, 0.7, D - 0.02);
  const top = place(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 18, 1, false, Math.PI / 2, Math.PI), m.door), 0, 1.4, D - 0.02);
  top.rotation.x = Math.PI / 2;
  doors.push(leaf, top);
  doors.push(ball(0.045, 0.045, 0.045, m.gold, 0.32, 0.95, D - 0.1));
  // The frame follows the door: two posts up to the springing of the arch, then a half ring
  // over the round top.
  for (const x of [-0.53, 0.53]) g.add(box(0.07, 1.4, 0.1, m.trim, x, 0.7, D + 0.01));
  const arch = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.57, 24, 1, 0, Math.PI), m.trim);
  arch.material = m.trim.clone();
  arch.material.side = THREE.DoubleSide;
  place(arch, 0, 1.4, D - 0.03);
  // The wall closes the corners either side of the curve.
  const spandrel = new THREE.Shape([new THREE.Vector2(-0.55, 0), new THREE.Vector2(0.55, 0), new THREE.Vector2(0.55, 0.55), new THREE.Vector2(-0.55, 0.55)]);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.5, 0, Math.PI, false);
  hole.lineTo(0.5, 0);
  spandrel.holes.push(hole);
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(spandrel, 24), interiorMat(0xfdf1dc, 0.5));
  fill.material.side = THREE.DoubleSide;
  place(fill, 0, 1.4, D - 0.005);

  // A window each side of the door, like the cottage outside, with a flower box. The glass
  // follows the sky like the others.
  const glass = new THREE.MeshBasicMaterial({ color: 0xcfe8f5 });
  const glassDay = new THREE.Color(0xcfe8f5);
  const glassNight = new THREE.Color(0x1d2744);
  for (const wx of [-2.2, 2.2]) {
    g.add(box(1.0, 1.0, 0.07, m.trim, wx, 1.5, D - 0.035));
    g.add(box(0.8, 0.8, 0.08, glass, wx, 1.5, D - 0.04));
    g.add(box(0.9, 0.05, 0.09, m.trim, wx, 1.5, D - 0.05));
    g.add(box(0.05, 0.9, 0.09, m.trim, wx, 1.5, D - 0.05));
    g.add(box(1.1, 0.06, 0.2, m.woodLight, wx, 0.97, D - 0.1));
    for (const [dx, c] of [[-0.3, m.pink], [0, m.yellow], [0.3, m.red]]) ball(0.07, 0.09, 0.07, c, wx + dx, 1.06, D - 0.14);
  }

  // The hearth on the back wall: a stone chimney breast, a mantel, and a fire that flickers.
  g.add(box(1.7, 1.3, 0.55, m.stone, 0, 0.65, -D + 0.28));
  g.add(box(1.25, H - 1.3, 0.4, m.stone, 0, 1.3 + (H - 1.3) / 2, -D + 0.2));
  g.add(box(0.95, 0.75, 0.1, m.dark, 0, 0.5, -D + 0.56));
  g.add(box(0.95, 0.06, 0.2, m.stoneDark, 0, 0.1, -D + 0.62));
  g.add(box(2.0, 0.09, 0.62, m.woodLight, 0, 1.36, -D + 0.32));
  for (const dx of [-0.8, 0.8]) g.add(box(0.1, 0.1, 0.1, m.beam, dx, 1.27, -D + 0.5));
  for (const [dx, h] of [[-0.55, 0.16], [-0.35, 0.1], [0.5, 0.2]]) {
    g.add(box(0.06, h, 0.06, m.cream, dx, 1.41 + h / 2, -D + 0.4)); // candles on the mantel
    g.add(ball(0.025, 0.04, 0.025, m.fireTip, dx, 1.43 + h, -D + 0.4));
  }
  for (const dx of [-0.25, 0.1]) g.add(box(0.5, 0.1, 0.1, m.beam, dx, 0.18, -D + 0.6)); // logs
  const flames = [];
  for (const [dx, h, color] of [[-0.18, 0.5, m.fireBase], [0.02, 0.62, m.fireTip], [0.2, 0.44, m.fireBase]]) {
    const flame = place(new THREE.Mesh(new THREE.ConeGeometry(0.13, h, 7), color), dx, 0.22 + h / 2, -D + 0.58);
    flame.userData.h = h;
    flames.push(flame);
  }
  place(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), m.fireTip), 0.02, 0.37, -D + 0.6);
  const halos = [];
  const halo = (x, y, z, size, opacity) => {
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc060, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    h.scale.setScalar(size);
    h.position.set(x, y, z);
    g.add(h);
    return h;
  };
  const fireGlow = halo(0, 0.6, -D + 0.9, 3.2, 0.5);

  // A round table with a teapot, two cups and a bowl of fruit, and two stools.
  const TABLE = { x: -2.9, z: -0.8 };
  cyl(0.6, 0.6, 0.06, m.woodLight, TABLE.x, 0.74, TABLE.z, 20);
  cyl(0.07, 0.1, 0.72, m.wood, TABLE.x, 0.36, TABLE.z, 8);
  cyl(0.3, 0.3, 0.04, m.wood, TABLE.x, 0.03, TABLE.z, 12);
  for (const [dx, dz] of [[0.95, 0], [0, 0.85], [0.1, -0.85]]) {
    cyl(0.22, 0.22, 0.05, m.wood, TABLE.x + dx, 0.42, TABLE.z + dz, 12);
    for (const [lx, lz] of [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]]) g.add(box(0.04, 0.4, 0.04, m.wood, TABLE.x + dx + lx, 0.2, TABLE.z + dz + lz));
  }
  ball(0.13, 0.11, 0.13, m.mint, TABLE.x - 0.1, 0.9, TABLE.z + 0.05); // teapot
  ball(0.05, 0.04, 0.04, m.mint, TABLE.x + 0.03, 0.9, TABLE.z + 0.07);
  g.add(box(0.03, 0.1, 0.03, m.mint, TABLE.x - 0.1, 1.03, TABLE.z + 0.05));
  for (const [dx, dz] of [[0.25, 0.15], [0.22, -0.2]]) {
    cyl(0.05, 0.04, 0.06, m.cream, TABLE.x + dx, 0.8, TABLE.z + dz, 10);
  }
  cyl(0.13, 0.09, 0.07, m.clay, TABLE.x - 0.25, 0.8, TABLE.z - 0.25, 10);
  for (const [dx, dz, c] of [[-0.28, -0.25, m.red], [-0.22, -0.28, m.yellow], [-0.24, -0.2, m.red]]) ball(0.04, 0.04, 0.04, c, TABLE.x + dx, 0.87, TABLE.z + dz);
  halos.push(halo(TABLE.x, 1.0, TABLE.z, 0.7, 0));

  // A bed against the right-hand wall, with a patchwork quilt and two pillows.
  const BED = { x: W - 0.75, z: -D + 1.15 };
  g.add(box(1.4, 0.3, 2.3, m.wood, BED.x, 0.25, BED.z));
  g.add(box(1.3, 0.2, 2.2, m.cream, BED.x, 0.5, BED.z));
  g.add(box(1.5, 0.95, 0.1, m.wood, BED.x, 0.6, -D + 0.07));
  g.add(box(1.5, 0.45, 0.1, m.wood, BED.x, 0.3, BED.z + 1.2));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
    const c = [m.pink, m.mint, m.yellow, m.blue, m.cream][(i * 2 + j * 3) % 5];
    g.add(box(0.31, 0.04, 0.3, c, BED.x - 0.48 + i * 0.32, 0.62, BED.z - 0.55 + j * 0.31 + 0.3));
  }
  ball(0.28, 0.08, 0.16, m.trim, BED.x - 0.3, 0.64, -D + 0.38);
  ball(0.28, 0.08, 0.16, m.pink, BED.x + 0.3, 0.64, -D + 0.38);

  // An open bookcase on the left wall, a frame with a back and four shelves, full of books,
  // with jars and a plant on top.
  const SHELF = { x: -W + 0.2, z: 1.9 };
  g.add(box(0.05, 2.0, 1.3, m.wood, -W + 0.05, 1.0, SHELF.z)); // back
  for (const dz of [-0.65, 0.65]) g.add(box(0.34, 2.0, 0.06, m.wood, SHELF.x + 0.02, 1.0, SHELF.z + dz)); // sides
  g.add(box(0.36, 0.06, 1.36, m.wood, SHELF.x + 0.02, 2.0, SHELF.z)); // top
  const bookColours = [m.red, m.blue, m.yellow, m.mint, m.pink, m.clay, m.leaf];
  for (const y of [0.04, 0.5, 0.95, 1.4, 1.85]) {
    g.add(box(0.32, 0.04, 1.24, m.woodLight, SHELF.x + 0.02, y + 0.02, SHELF.z));
    if (y > 1.8) continue;
    let z = -0.58;
    for (let k = 0; z < 0.52; k++) {
      const w = 0.07 + seeded(k * 3 + y * 10) * 0.05;
      const h = 0.26 + seeded(k * 7 + y * 5) * 0.14;
      if (seeded(k * 11 + y * 3) < 0.12) { z += 0.12; continue; } // a gap, so it looks lived in
      g.add(box(0.22, h, w, bookColours[(k + Math.floor(y * 10)) % 7], SHELF.x + 0.05, y + 0.04 + h / 2, SHELF.z + z + w / 2));
      z += w + 0.01;
    }
  }
  cyl(0.08, 0.06, 0.12, m.clay, SHELF.x + 0.05, 2.09, SHELF.z - 0.3, 8);
  ball(0.12, 0.14, 0.12, m.leaf, SHELF.x + 0.05, 2.23, SHELF.z - 0.3);
  cyl(0.06, 0.06, 0.16, m.trim, SHELF.x + 0.05, 2.11, SHELF.z + 0.25, 8);

  // A basket with a blanket in it, by the fire, for the pet.
  const BASKET = { x: 1.15, z: -D + 0.6 };
  cyl(0.38, 0.32, 0.18, m.woodLight, BASKET.x, 0.09, BASKET.z, 14);
  cyl(0.3, 0.3, 0.02, m.pink, BASKET.x, 0.14, BASKET.z, 14);
  ball(0.2, 0.04, 0.2, m.cream, BASKET.x, 0.17, BASKET.z);

  // Large paintings and other things on the walls. Each is a framed scene made of a few flat
  // shapes, hung on a wall by turning it to face into the room.
  const painting = (w, h, sky, hill, hill2, x, y, z, turn) => {
    const pg = new THREE.Group();
    const add = (mesh, px, py, pz) => { mesh.position.set(px, py, pz); pg.add(mesh); return mesh; };
    add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, h + 0.16, 0.06), m.wood), 0, 0, 0);
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), sky), 0, 0, 0.005);
    add(new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.38, 0.08), hill2), 0, -h * 0.31, 0.01);
    add(new THREE.Mesh(new THREE.BoxGeometry(w * 0.6, h * 0.26, 0.09), hill), -w * 0.18, -h * 0.25, 0.015);
    add(cowBlob(w * 0.07, w * 0.07, 0.02, m.yellow), w * 0.28, h * 0.25, 0.05);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.04, h * 0.2, 0.1), m.wood), w * 0.12, -h * 0.12, 0.06);
    add(cowBlob(w * 0.07, w * 0.08, 0.03, m.leaf), w * 0.12, -h * 0.01, 0.07);
    pg.position.set(x, y, z);
    pg.rotation.y = turn;
    g.add(pg);
  };
  painting(1.7, 1.1, m.blue, m.leaf, m.mint, -2.6, 1.85, -D + 0.06, 0);
  painting(1.1, 0.8, m.pink, m.yellow, m.clay, 1.95, 1.9, -D + 0.06, 0);
  painting(1.0, 0.7, m.mint, m.leaf, m.stoneDark, -W + 0.06, 1.8, -2.5, Math.PI / 2);
  painting(0.9, 0.6, m.cream, m.pink, m.red, -W + 0.06, 1.8, 0.45, Math.PI / 2);
  painting(0.8, 0.55, m.yellow, m.mint, m.leaf, -W + 0.06, 1.8, 3.0, Math.PI / 2);
  // A woven hanging by the bed, and a round clock over the door.
  for (let i = 0; i < 5; i++) g.add(box(1.0 - i * 0.12, 0.22, 0.04, [m.pink, m.cream, m.mint, m.yellow, m.blue][i], 2.0, 2.35 - i * 0.22, -D + 0.05));
  g.add(box(1.1, 0.04, 0.05, m.wood, 2.0, 2.5, -D + 0.05));
  cyl(0.26, 0.26, 0.05, m.wood, 0, 2.75, D - 0.05, 20).rotation.x = Math.PI / 2;
  cyl(0.21, 0.21, 0.06, m.trim, 0, 2.75, D - 0.07, 20).rotation.x = Math.PI / 2;
  g.add(box(0.025, 0.15, 0.02, m.dark, 0, 2.81, D - 0.11));
  g.add(box(0.1, 0.025, 0.02, m.dark, 0.04, 2.75, D - 0.11));
  // Pot plants in two corners and a coat rack by the door.
  for (const [px, pz] of [[-W + 0.55, D - 0.55], [-W + 0.55, -D + 0.6]]) {
    cyl(0.2, 0.15, 0.3, m.clay, px, 0.15, pz, 10);
    ball(0.3, 0.38, 0.3, m.leaf, px, 0.62, pz);
    ball(0.2, 0.25, 0.2, m.leaf, px + 0.12, 0.98, pz - 0.05);
  }
  g.add(box(0.7, 0.06, 0.05, m.wood, 1.2, 1.7, D - 0.05));
  for (const hx of [0.95, 1.2, 1.45]) g.add(ball(0.035, 0.035, 0.035, m.gold, hx, 1.66, D - 0.1));
  ball(0.17, 0.2, 0.06, m.red, 0.95, 1.5, D - 0.12); // a coat
  // A woven basket of logs by the hearth.
  cyl(0.25, 0.22, 0.28, m.woodLight, -1.7, 0.14, -D + 0.5, 12);
  for (const [dx, dy] of [[-0.08, 0.3], [0.08, 0.3], [0, 0.38]]) cyl(0.07, 0.07, 0.4, m.beam, -1.7 + dx, dy, -D + 0.5, 8).rotation.z = Math.PI / 2;

  // Two windows, with flower boxes: one over the table, one by the bed. The light by day.
  const shafts = [];
  for (const [side, z] of [[-1, -0.8], [1, 1.9]]) {
    const x = side * (W - 0.02);
    g.add(box(0.07, 1.0, 1.0, m.trim, x, 1.45, z));
    g.add(box(0.08, 0.8, 0.8, glass, x - side * 0.01, 1.45, z));
    g.add(box(0.09, 0.05, 0.9, m.trim, x - side * 0.02, 1.45, z));
    g.add(box(0.09, 0.9, 0.05, m.trim, x - side * 0.02, 1.45, z));
    g.add(box(0.18, 0.06, 1.05, m.woodLight, x - side * 0.06, 0.93, z));
    for (const dz of [-0.3, 0, 0.3]) ball(0.07, 0.09, 0.07, [m.pink, m.yellow, m.red][Math.round(dz * 10 / 3) + 1] ?? m.pink, x - side * 0.08, 1.02, z + dz);
    for (const [r, k] of [[1, 0], [-1, 1]]) {
      const shaftMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      if (r < 0) continue;
      const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.4, 0.8), shaftMat);
      shaft.position.set(side * (W - 0.7), 0.9, z);
      shaft.rotation.z = side * -0.7;
      g.add(shaft);
      shafts.push(shaftMat);
      void k;
    }
  }
  // A lantern from the middle beam, a small one by the door, and the glow of each.
  const hang = (x, y, z, size) => {
    g.add(box(0.02, H - y - 0.1, 0.02, m.dark, x, (H + y) / 2 - 0.05, z));
    g.add(box(0.18, 0.24, 0.18, barnLantern, x, y, z));
    g.add(box(0.24, 0.04, 0.24, m.dark, x, y + 0.14, z));
    halos.push(halo(x, y, z, size, 0.4));
  };
  hang(0.6, 1.95, 0.4, 2.2);
  hang(-0.9, 1.9, 2.2, 1.4);
  hang(-2.6, 1.95, -0.8, 1.6);

  const obstacles = [
    [-0.95, 0.95, -D, -D + 0.65],
    [-3.55, -1.3, -1.8, 0.2],
    [W - 1.55, W, -D, -D + 2.3],
    [-W, -W + 0.55, 1.2, 2.6],
    [0.75, 1.6, -D, -D + 1.0],
    [W - 0.8, W, 0.2, D],
    [-W, -W + 0.9, D - 0.9, D],
    [-W, -W + 0.9, -D, -D + 0.9],
  ];
  const cottage = {
    id: "cottage",
    group: g,
    at: COTTAGE_IN_AT,
    start: { x: 0, z: 0.9 },
    bounds: { x0: -(W - 0.3), x1: W - 0.3, z0: -(D - 0.25), z1: D - 0.25 },
    obstacles,
    doors,
    pet: true,
    follow: { back: 2.3, up: 1.15 },
    title: "The cottage",
    note: "Only you can see in here. Walk with W A S D, turn with the arrow keys or by dragging. Click your pet to stroke it.",
    welcome: "Inside the cottage. Only you can see in here.",
    doorHint: "Click the door to go back outside",
    glass,
    glassDay,
    glassNight,
    shafts,
    halos,
    flames,
    fireGlow,
  };
  scene.add(g);
  return cottage;
})();
cottageIn.update = (now) => {
  cottageIn.glass.color.copy(cottageIn.glassNight).lerp(cottageIn.glassDay, dayness);
  const sun = dayness * (1 - 0.8 * weatherNow.cloud);
  for (const shaft of cottageIn.shafts) shaft.opacity = sun * 0.05;
  for (const h of cottageIn.halos) h.material.opacity = 0.3 + 0.5 * skyNight;
  const t = now / 1000;
  // The fire dances unless you've asked for stillness.
  const dance = stillMotion.matches ? 0 : 1;
  cottageIn.flames.forEach((flame, i) => {
    flame.scale.set(1 + Math.sin(t * 9 + i * 2) * 0.12 * dance, 1 + Math.sin(t * 13 + i * 3) * 0.2 * dance, 1);
    flame.position.y = 0.22 + (flame.userData.h * flame.scale.y) / 2;
  });
  cottageIn.fireGlow.material.opacity = 0.45 + Math.sin(t * 11) * 0.06 * dance;
};
cottageIn.pick = () => {
  const pet = petUnderPointer();
  return pet ? { distance: pet.distance, label: `Click to stroke ${petObj.name}`, act: strokePet } : null;
};

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
  // A lane from the barn doors out to the first one, so the barn has a way in from the garden.
  barnGroup.updateMatrixWorld(true);
  const barnDoor = barnGroup.localToWorld(new THREE.Vector3(0, 0, 1.9));
  const barnStart = [barnDoor.x, barnDoor.z];
  const laneC = [barnStart, bend(barnStart, [6, -17.2], 0.35, 0.9), bend(barnStart, [6, -17.2], 0.7, -0.7), [6, -17.0]];
  const edges = [...buildLane(laneA, 1.25, 0.4), ...buildLane(laneB, 1.1, 2.2), ...buildLane(laneC, 1.2, 5.3)];
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
      addPetStone(stone);
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

// The barn's windows and loft door glow from dusk until dawn, on the same light as the
// cottage's, and the halos swell with the night.
function updateBarn(night) {
  barnGlass.color.copy(barnGlassDay).lerp(barnGlassNight, 1 - dayness);
  for (const halo of barnGlows) halo.material.opacity = 0.8 * night;
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
  const night = skyNight;
  for (const { halo, globeMaterial } of gardenLightGlows) {
    halo.material.opacity = 0.75 * night;
    globeMaterial.emissiveIntensity = 0.25 + 0.9 * night;
  }
  updateBarn(night);
  for (const { group } of ownDecorBuilt.values()) {
    if (group.userData.halo) group.userData.halo.material.opacity = 0.9 * night;
  }
  const fireflyNight = night * (1 - clamp01(weatherNow.rainAmt * 2));
  fireflies.visible = fireflyNight > 0.02;
  if (!fireflies.visible) return;
  fireflyUniforms.night.value = fireflyNight;
  // With reduced motion they hold still and only glow softly.
  // The page's own clock, not the server's: the server's is about 1.7 billion seconds,
  // too big for the shader's floats to move in steps smaller than a couple of minutes.
  fireflyUniforms.time.value = stillMotion.matches ? 0 : performance.now() / 1000;
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  fireflyUniforms.pixelsPerUnit.value = size.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
}

// After rain: puddles on the lawn and, if the sun is out as the rain clears, a rainbow.
// Like the weather they are a pure function of the server's clock, so everyone sees the
// same ones at the same moment. They are only a picture: nothing is sent, stored or logged,
// and a puddle never waters a plant or stops anyone walking or acting.

// How much rain has fallen lately, from 0 to 1, fading over `span` milliseconds.
function recentRain(ms, span) {
  let wet = 0;
  for (let i = 0; i <= 8; i++) {
    const rainAmt = clamp01((weatherAt(ms - (i * span) / 8).rain - 0.35) / 0.65);
    wet = Math.max(wet, rainAmt * (1 - i / 8));
  }
  return wet;
}

const puddleUniforms = { time: { value: 0 }, rain: { value: 0 }, sky: { value: new THREE.Color() } };
const puddleMaterial = new THREE.ShaderMaterial({
  uniforms: puddleUniforms,
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -3,
  polygonOffsetUnits: -3,
  vertexShader: `
    varying vec2 vUv;
    varying vec2 vOrigin;
    void main() {
      vUv = uv;
      vOrigin = modelMatrix[3].xz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform float time;
    uniform float rain;
    uniform vec3 sky;
    varying vec2 vUv;
    varying vec2 vOrigin;
    void main() {
      vec2 p = (vUv - 0.5) * 2.0;
      float seed = fract(sin(dot(vOrigin, vec2(12.9898, 78.233))) * 43758.5453);
      // A wobbly edge, so no two puddles are the same shape.
      float d = length(p) * (1.0 + 0.1 * sin(atan(p.y, p.x) * 3.0 + seed * 20.0) + 0.05 * sin(atan(p.y, p.x) * 7.0 + seed * 9.0));
      float edge = 1.0 - smoothstep(0.78, 1.0, d);
      // Water shows the sky, a little darker toward the middle.
      vec3 colour = mix(sky * 0.4, sky, 0.55 + 0.3 * smoothstep(0.0, 1.0, d));
      // Raindrops make rings that spread and fade.
      float rings = 0.0;
      for (int k = 0; k < 2; k++) {
        float phase = fract(time * 0.55 + seed + float(k) * 0.5);
        rings += smoothstep(0.07, 0.0, abs(d - phase * 0.95)) * (1.0 - phase);
      }
      // Even on a dark night, water holds a little blue light.
      colour = max(colour, vec3(0.1, 0.13, 0.19));
      colour += rings * rain * 0.3;
      gl_FragColor = vec4(colour, edge * 0.78);
    }`,
});
const puddles = [];
{
  const geometry = new THREE.CircleGeometry(1, 28);
  const avoid = [[BARN_AT, 6], [COTTAGE_AT, 7], [OWN_CENTRE, 8]];
  let tries = 0;
  for (let i = 0; puddles.length < 30 && tries < 900; tries++) {
    const angle = seeded(7300 + tries * 3) * Math.PI * 2;
    const radius = 13 + seeded(7301 + tries * 3) * 11;
    const x = GARDEN_CENTRE.x + Math.cos(angle) * radius;
    const z = GARDEN_CENTRE.z + Math.sin(angle) * radius;
    // Keep them on open lawn: clear of the buildings, my garden and the dirt lanes.
    if (avoid.some(([at, gap]) => Math.hypot(x - at.x, z - at.z) < gap)) continue;
    if (laneSamples.some((l) => Math.hypot(x - l.x, z - l.z) < 2.2)) continue;
    const mesh = new THREE.Mesh(geometry, puddleMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, GROUND_Y + 0.03, z);
    mesh.userData.size = 1.3 + seeded(7302 + tries * 3) * 1.4;
    mesh.userData.stretch = 0.6 + seeded(7303 + tries * 3) * 0.4;
    mesh.userData.after = 0.55 + 0.45 * seeded(7304 + tries * 3); // the shallow ones dry first
    mesh.visible = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
    puddles.push(mesh);
    i++;
  }
}

function updatePuddles() {
  // Puddles gather as it rains and dry out over a quarter of a garden day. None under snow.
  const wet = recentRain(serverNow(), dayLengthMs * 0.25) * (1 - seasonNow.snow);
  puddleUniforms.time.value = stillMotion.matches ? 0.3 : performance.now() / 1000;
  puddleUniforms.rain.value = stillMotion.matches ? 0 : weatherNow.rainAmt * (1 - seasonNow.snow);
  puddleUniforms.sky.value.copy(skyColour);
  for (const puddle of puddles) {
    const size = clamp01((wet - 0.1) / 0.9 / puddle.userData.after) * puddle.userData.size;
    puddle.visible = size > 0.05;
    puddle.scale.set(size, size * puddle.userData.stretch, 1);
  }
}

// The rainbow: a soft arc of seven colours, there for a little while when the rain has
// just cleared and the sun is out. It hangs over the garden for show (a real one faces
// away from the sun), at a fixed place in the world, so turning the view moves it.
const RAINBOW_DISTANCE = 98;
const RAINBOW_ANGLE = (30 * Math.PI) / 180; // its middle, from the centre of the arc
const RAINBOW_AXIS = new THREE.Vector3(0.707, Math.sin((-6 * Math.PI) / 180), -0.707).normalize();
const rainbow = (() => {
  const bands = 28;
  const inner = RAINBOW_DISTANCE * Math.tan(RAINBOW_ANGLE - 0.045);
  const outer = RAINBOW_DISTANCE * Math.tan(RAINBOW_ANGLE + 0.045);
  const geometry = new THREE.RingGeometry(inner, outer, 120, bands);
  const stops = [0xff4d4d, 0xff9a3c, 0xffe24a, 0x5fd16a, 0x4aa8ff, 0x6a5cff, 0xb15cff].map((c) => new THREE.Color(c));
  const colours = [];
  const colour = new THREE.Color();
  // RingGeometry lays its vertices ring by ring, from the inner edge outwards.
  for (let band = 0; band <= bands; band++) {
    const t = 1 - band / bands; // red is the outer edge
    const at = t * (stops.length - 1);
    const i = Math.min(Math.floor(at), stops.length - 2);
    colour.copy(stops[i]).lerp(stops[i + 1], at - i);
    const alpha = Math.sin((band / bands) * Math.PI);
    for (let k = 0; k <= 120; k++) colours.push(colour.r, colour.g, colour.b, alpha * alpha);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colours, 4));
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.visible = false;
  scene.add(mesh);
  return mesh;
})();

function updateRainbow() {
  const lift = Math.sin(Math.asin(Math.min(1, Math.max(0, sunDisc.position.y - camera.position.y) / SKY_DISC_DISTANCE)));
  // Only with the sun up, but not high overhead, as the rain clears and the cloud lifts.
  const sunUp = smooth(clamp01((lift - 0.02) / 0.1)) * (1 - smooth(clamp01((lift - 0.24) / 0.06)));
  const cleared = recentRain(serverNow(), dayLengthMs * 0.2) * (1 - weatherNow.rainAmt) * (1 - clamp01((weatherNow.cloud - 0.1) / 0.5));
  const amount = cleared * sunUp * (1 - seasonNow.snow);
  rainbow.visible = amount > 0.02;
  if (!rainbow.visible) return;
  rainbow.material.opacity = 0.6 * amount;
  rainbow.position.copy(camera.position).addScaledVector(RAINBOW_AXIS, RAINBOW_DISTANCE);
  rainbow.lookAt(camera.position);
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  updateGlide(now);
  if (interiorMode) updateInterior(now);
  else controls.update();
  updateBedSigns();
  updateOwnSign();
  updateRoomSigns();
  tickAnimations(now);
  updateRings(now);
  updateSky();
  updateRain();
  updateFall();
  // No weather indoors.
  if (interiorMode) rain.visible = fall.visible = false;
  updatePuddles();
  updateRainbow();
  updateClouds(serverNow() / 1000);
  updateInsects(serverNow() / 1000);
  updateFireflies(serverNow() / 1000);
  updateCows(serverNow() / 1000);
  updateHens(serverNow() / 1000);
  updatePetFrame();
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
