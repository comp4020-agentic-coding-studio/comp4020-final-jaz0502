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
