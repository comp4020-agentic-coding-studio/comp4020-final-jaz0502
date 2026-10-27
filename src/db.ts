import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { GRID_SIZE } from "./garden.ts";
import type { PlantType, Plot, PlotState } from "./types.ts";

// Defaults to the Fly volume; overridable for local dev/CI where /data may
// not exist or may be tmpfs.
const DB_PATH = process.env.DB_PATH ?? "/data/garden.db";
const BED_ID = "main";

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS plots (
    bed_id          TEXT    NOT NULL DEFAULT 'main',
    position        INTEGER NOT NULL,
    state           TEXT    NOT NULL DEFAULT 'empty'
                    CHECK (state IN ('empty','planted','sprout','mature','wilted')),
    plant_type      TEXT    NOT NULL DEFAULT 'tree',
    planted_at      INTEGER,
    planted_by      TEXT,
    last_watered_at INTEGER,
    last_watered_by TEXT,
    PRIMARY KEY (bed_id, position)
  );
`);

// CREATE TABLE IF NOT EXISTS leaves an existing table alone, so a garden that
// was planted before plant types existed (the live volume) has no plant_type
// column yet. Add it with the default, which turns every plant already there
// into the tree it always was.
const columns = db.prepare("PRAGMA table_info(plots)").all() as unknown as { name: string }[];
if (!columns.some((column) => column.name === "plant_type")) {
  db.exec("ALTER TABLE plots ADD COLUMN plant_type TEXT NOT NULL DEFAULT 'tree'");
}

const seed = db.prepare(
  "INSERT OR IGNORE INTO plots (bed_id, position, state) VALUES (?, ?, 'empty')",
);
for (let position = 0; position < GRID_SIZE; position++) {
  seed.run(BED_ID, position);
}

interface PlotRow {
  position: number;
  state: PlotState;
  plant_type: PlantType;
  planted_at: number | null;
  planted_by: string | null;
  last_watered_at: number | null;
  last_watered_by: string | null;
}

function rowToPlot(row: PlotRow): Plot {
  return {
    position: row.position,
    state: row.state,
    plantType: row.state === "empty" ? null : row.plant_type,
    plantedAt: row.planted_at,
    plantedBy: row.planted_by,
    lastWateredAt: row.last_watered_at,
    lastWateredBy: row.last_watered_by,
  };
}

const listStmt = db.prepare("SELECT * FROM plots WHERE bed_id = ? ORDER BY position");
const getStmt = db.prepare("SELECT * FROM plots WHERE bed_id = ? AND position = ?");

// Rows are stored with only ever 'empty' or 'planted' as a literal state —
// the growth stages and 'wilted' are purely a read-time view computed by
// garden.ts's derivePlot from the timestamps below, never written back here.
export function listPlots(): Plot[] {
  return (listStmt.all(BED_ID) as unknown as PlotRow[]).map(rowToPlot);
}

export function getPlot(position: number): Plot | undefined {
  const row = getStmt.get(BED_ID, position) as unknown as PlotRow | undefined;
  return row ? rowToPlot(row) : undefined;
}

const plantStmt = db.prepare(`
  UPDATE plots
  SET state = 'planted', plant_type = ?, planted_at = ?, planted_by = ?, last_watered_at = ?, last_watered_by = ?
  WHERE bed_id = ? AND position = ? AND state = 'empty'
`);

// The WHERE state = 'empty' guard is sufficient by itself: unlike the
// growth stages, 'empty' is never something derivePlot produces on its own
// — only compost() ever sets it — so the stored column is always accurate
// for this specific check. node:sqlite's DatabaseSync API is synchronous,
// so with no `await` around this call, no other request's handler can
// interleave between the check and the write.
export function plant(position: number, actorId: string, plantType: PlantType): Plot | undefined {
  const now = Date.now();
  const result = plantStmt.run(plantType, now, actorId, now, actorId, BED_ID, position);
  return result.changes > 0 ? getPlot(position) : undefined;
}

const waterStmt = db.prepare(
  "UPDATE plots SET last_watered_at = ?, last_watered_by = ? WHERE bed_id = ? AND position = ?",
);

// Callers are expected to have already checked the derived state (via
// garden.ts's derivePlot) before calling this — this just records the visit.
export function water(position: number, actorId: string): Plot | undefined {
  waterStmt.run(Date.now(), actorId, BED_ID, position);
  return getPlot(position);
}

const compostStmt = db.prepare(`
  UPDATE plots
  SET state = 'empty', planted_at = NULL, planted_by = NULL, last_watered_at = NULL, last_watered_by = NULL
  WHERE bed_id = ? AND position = ?
`);

export function compost(position: number): Plot | undefined {
  compostStmt.run(BED_ID, position);
  return getPlot(position);
}

// What each gardener has done, kept as a plain record for them and nobody else.
// It is a new table, so on the live volume CREATE TABLE IF NOT EXISTS simply adds
// it and nothing already there is touched. It is keyed by the public id, so the
// cookie never goes into it. Counting starts from when this shipped: there is no
// history of earlier actions to count from.
db.exec(`
  CREATE TABLE IF NOT EXISTS gardener_stats (
    id        TEXT    PRIMARY KEY,
    planted   INTEGER NOT NULL DEFAULT 0,
    watered   INTEGER NOT NULL DEFAULT 0,
    composted INTEGER NOT NULL DEFAULT 0,
    since     INTEGER NOT NULL
  );
`);

export interface GardenerStats {
  planted: number;
  watered: number;
  composted: number;
  // When their first counted action was, or null if they haven't done one.
  since: number | null;
}

// A row appears on someone's first action, and only this many gardeners are
// counted, so a stranger minting cookies can't grow the database without limit.
// Past it, new gardeners simply aren't counted.
const MAX_COUNTED_GARDENERS = Number(process.env.MAX_COUNTED_GARDENERS ?? 5000);

const statsStmt = db.prepare("SELECT planted, watered, composted, since FROM gardener_stats WHERE id = ?");
const countStmt = db.prepare("SELECT COUNT(*) AS n FROM gardener_stats");
const createStatsStmt = db.prepare("INSERT OR IGNORE INTO gardener_stats (id, since) VALUES (?, ?)");
const bumpStmts = {
  plant: db.prepare("UPDATE gardener_stats SET planted = planted + 1 WHERE id = ?"),
  water: db.prepare("UPDATE gardener_stats SET watered = watered + 1 WHERE id = ?"),
  compost: db.prepare("UPDATE gardener_stats SET composted = composted + 1 WHERE id = ?"),
};

export function getStats(id: string): GardenerStats {
  const row = statsStmt.get(id) as unknown as GardenerStats | undefined;
  return row ? { ...row } : { planted: 0, watered: 0, composted: 0, since: null };
}

export function recordAction(id: string, action: "plant" | "water" | "compost", now: number): GardenerStats {
  if (!statsStmt.get(id)) {
    const { n } = countStmt.get() as unknown as { n: number };
    if (n >= MAX_COUNTED_GARDENERS) return getStats(id);
    createStatsStmt.run(id, now);
  }
  bumpStmts[action].run(id);
  return getStats(id);
}

// Seeds a gardener has gathered from fully grown plants, for their own garden. Like
// the record, they are keyed by the public id, never the cookie, and go to that
// gardener alone. They are what you can plant, not a collection: no totals are
// kept, and a gardener holds at most SEED_CAP of each kind. `gathered` remembers
// which plants someone has already gathered from (a plant is its plot and when it
// was planted), so one plant gives seeds to each gardener once in its life.
db.exec(`
  CREATE TABLE IF NOT EXISTS seeds (
    owner      TEXT    NOT NULL,
    plant_type TEXT    NOT NULL,
    count      INTEGER NOT NULL,
    PRIMARY KEY (owner, plant_type)
  );
  CREATE TABLE IF NOT EXISTS gathered (
    owner      TEXT    NOT NULL,
    position   INTEGER NOT NULL,
    planted_at INTEGER NOT NULL,
    PRIMARY KEY (owner, position, planted_at)
  );
`);

export const SEEDS_PER_GATHER = 3;
export const SEED_CAP = 6;

// Only this many gardeners can keep seeds, so a stranger minting cookies can't grow
// the database without limit.
const MAX_SEED_KEEPERS = Number(process.env.MAX_SEED_KEEPERS ?? 2000);

export type Seeds = Partial<Record<PlantType, number>>;

const seedsStmt = db.prepare("SELECT plant_type, count FROM seeds WHERE owner = ? AND count > 0 ORDER BY plant_type");
const seedCountStmt = db.prepare("SELECT count FROM seeds WHERE owner = ? AND plant_type = ?");
const keepersStmt = db.prepare("SELECT COUNT(DISTINCT owner) AS n FROM seeds");
const keepsStmt = db.prepare("SELECT 1 FROM seeds WHERE owner = ? LIMIT 1");
const setSeedsStmt = db.prepare(`
  INSERT INTO seeds (owner, plant_type, count) VALUES (?, ?, ?)
  ON CONFLICT (owner, plant_type) DO UPDATE SET count = excluded.count
`);
const gatheredStmt = db.prepare("SELECT 1 FROM gathered WHERE owner = ? AND position = ? AND planted_at = ?");
const markGatheredStmt = db.prepare("INSERT OR IGNORE INTO gathered (owner, position, planted_at) VALUES (?, ?, ?)");
// A plant that has been composted can never be gathered from again, so its rows
// are of no more use.
const forgetGatheredStmt = db.prepare("DELETE FROM gathered WHERE position = ? AND planted_at <> ?");

export function getSeeds(owner: string): Seeds {
  const seeds: Seeds = {};
  for (const row of seedsStmt.all(owner) as unknown as { plant_type: PlantType; count: number }[]) {
    seeds[row.plant_type] = row.count;
  }
  return seeds;
}

export type GatherResult =
  | { ok: true; seeds: Seeds; gained: number }
  | { ok: false; reason: "already-gathered" | "seeds-full" | "too-many-gardeners" };

// Takes seeds from a plant without touching it: only the gatherer's own rows change.
// The caller has already checked that the plant is fully grown.
export function gatherSeeds(owner: string, position: number, plantedAt: number, plantType: PlantType): GatherResult {
  if (gatheredStmt.get(owner, position, plantedAt)) return { ok: false, reason: "already-gathered" };
  const held = (seedCountStmt.get(owner, plantType) as unknown as { count: number } | undefined)?.count ?? 0;
  if (held >= SEED_CAP) return { ok: false, reason: "seeds-full" };
  if (!keepsStmt.get(owner)) {
    const { n } = keepersStmt.get() as unknown as { n: number };
    if (n >= MAX_SEED_KEEPERS) return { ok: false, reason: "too-many-gardeners" };
  }
  const gained = Math.min(SEEDS_PER_GATHER, SEED_CAP - held);
  forgetGatheredStmt.run(position, plantedAt);
  markGatheredStmt.run(owner, position, plantedAt);
  setSeedsStmt.run(owner, plantType, held + gained);
  return { ok: true, seeds: getSeeds(owner), gained };
}

// Each gardener's own garden: a few plots only they can plant, water and compost,
// grown from the seeds they have gathered. Stored by the owner's public id, never
// the cookie, and sent to their own streams alone. Like the shared garden, only
// 'empty' or 'planted' is stored and every stage is derived from the timestamps.
// A row appears only when someone first plants, so an empty garden takes no room.
db.exec(`
  CREATE TABLE IF NOT EXISTS own_plots (
    owner           TEXT    NOT NULL,
    position        INTEGER NOT NULL,
    state           TEXT    NOT NULL DEFAULT 'empty' CHECK (state IN ('empty', 'planted')),
    plant_type      TEXT,
    planted_at      INTEGER,
    last_watered_at INTEGER,
    PRIMARY KEY (owner, position)
  );
`);

export const OWN_GARDEN_SIZE = 16;

// Only this many gardeners can have a garden of their own.
const MAX_OWN_GARDENS = Number(process.env.MAX_OWN_GARDENS ?? 2000);

interface OwnRow {
  position: number;
  state: "empty" | "planted";
  plant_type: PlantType | null;
  planted_at: number | null;
  last_watered_at: number | null;
}

// The owner is never put in the plot: whose garden it is is never sent anywhere,
// and the page knows it is its own.
function ownRowToPlot(row: OwnRow): Plot {
  return {
    position: row.position,
    state: row.state,
    plantType: row.state === "empty" ? null : row.plant_type,
    plantedAt: row.planted_at,
    plantedBy: null,
    lastWateredAt: row.last_watered_at,
    lastWateredBy: null,
  };
}

const ownListStmt = db.prepare("SELECT * FROM own_plots WHERE owner = ?");
const ownGetStmt = db.prepare("SELECT * FROM own_plots WHERE owner = ? AND position = ?");
const ownHasStmt = db.prepare("SELECT 1 FROM own_plots WHERE owner = ? LIMIT 1");
const ownCountStmt = db.prepare("SELECT COUNT(DISTINCT owner) AS n FROM own_plots");
const ownPlantStmt = db.prepare(`
  INSERT INTO own_plots (owner, position, state, plant_type, planted_at, last_watered_at)
  VALUES (?, ?, 'planted', ?, ?, ?)
  ON CONFLICT (owner, position) DO UPDATE
    SET state = 'planted', plant_type = excluded.plant_type, planted_at = excluded.planted_at,
        last_watered_at = excluded.last_watered_at
    WHERE own_plots.state = 'empty'
`);
const ownWaterStmt = db.prepare("UPDATE own_plots SET last_watered_at = ? WHERE owner = ? AND position = ?");
const ownCompostStmt = db.prepare(`
  UPDATE own_plots SET state = 'empty', plant_type = NULL, planted_at = NULL, last_watered_at = NULL
  WHERE owner = ? AND position = ?
`);
const useSeedStmt = db.prepare("UPDATE seeds SET count = count - 1 WHERE owner = ? AND plant_type = ? AND count > 0");

// All of a gardener's own plots, in order, with the empty ones filled in.
export function listOwnPlots(owner: string): Plot[] {
  const rows = new Map((ownListStmt.all(owner) as unknown as OwnRow[]).map((row) => [row.position, row]));
  return Array.from({ length: OWN_GARDEN_SIZE }, (_, position) => {
    const row = rows.get(position);
    return row ? ownRowToPlot(row) : { position, state: "empty", plantType: null, plantedAt: null, plantedBy: null, lastWateredAt: null, lastWateredBy: null };
  });
}

export function getOwnPlot(owner: string, position: number): Plot | undefined {
  if (!Number.isInteger(position) || position < 0 || position >= OWN_GARDEN_SIZE) return undefined;
  return listOwnPlots(owner)[position];
}

export type OwnPlantResult = { ok: true } | { ok: false; reason: "no-seeds" | "not-empty" | "too-many-gardeners" };

// Plants one of the owner's seeds. The caller has checked the plot is empty once
// derived; the guard in the statement keeps it so.
export function plantOwn(owner: string, position: number, plantType: PlantType): OwnPlantResult {
  if (!ownHasStmt.get(owner)) {
    const { n } = ownCountStmt.get() as unknown as { n: number };
    if (n >= MAX_OWN_GARDENS) return { ok: false, reason: "too-many-gardeners" };
  }
  const held = (seedCountStmt.get(owner, plantType) as unknown as { count: number } | undefined)?.count ?? 0;
  if (held < 1) return { ok: false, reason: "no-seeds" };
  const now = Date.now();
  if (ownPlantStmt.run(owner, position, plantType, now, now).changes === 0) return { ok: false, reason: "not-empty" };
  useSeedStmt.run(owner, plantType);
  return { ok: true };
}

export function waterOwn(owner: string, position: number): void {
  ownWaterStmt.run(Date.now(), owner, position);
}

export function compostOwn(owner: string, position: number): void {
  ownCompostStmt.run(owner, position);
}

// Whether this gardener has a garden of their own yet, so the sweep can skip the
// many who don't.
export function hasOwnGarden(owner: string): boolean {
  return Boolean(ownHasStmt.get(owner));
}
