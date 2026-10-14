import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { publicId } from "../src/identity.ts";
import { type PrivateApp, newVisitor, readPlots, startApp } from "./support.ts";

// The live garden's database was created before plants had a type. Starting the
// app on such a database must keep every plant, as a tree, rather than failing
// on the missing column: this is what happens to the real volume on deploy.
let dir: string;
let app: PrivateApp;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "garden-old-"));
  const file = join(dir, "garden.db");

  // The table exactly as it was before plant types: no plant_type column.
  const old = new DatabaseSync(file);
  old.exec(`
    CREATE TABLE plots (
      bed_id          TEXT    NOT NULL DEFAULT 'main',
      position        INTEGER NOT NULL,
      state           TEXT    NOT NULL DEFAULT 'empty'
                      CHECK (state IN ('empty','planted','sprout','mature','wilted')),
      planted_at      INTEGER,
      planted_by      TEXT,
      last_watered_at INTEGER,
      last_watered_by TEXT,
      PRIMARY KEY (bed_id, position)
    );
  `);
  // The one bed it had then: 25 plots, all empty but one.
  const seed = old.prepare("INSERT INTO plots (bed_id, position, state) VALUES ('main', ?, 'empty')");
  for (let position = 0; position < 25; position++) seed.run(position);
  old
    .prepare(
      "UPDATE plots SET state = 'planted', planted_at = ?, planted_by = 'old-visitor', last_watered_at = ?, last_watered_by = 'old-visitor' WHERE position = 3",
    )
    .run(Date.now(), Date.now());
  old.close();

  app = await startApp({ DB_PATH: file, WILT_WINDOW_MS: "1000000" });
});

afterAll(async () => {
  if (app) await app.stop();
  rmSync(dir, { recursive: true, force: true });
});

it("keeps a plant from before plant types existed, as a tree with its owner", async () => {
  const plot = (await readPlots(app.url)).find((p) => p.position === 3)!;
  expect(plot.state).not.toBe("empty");
  expect(plot.plantType).toBe("tree");
  expect(plot.plantedBy).toBe(publicId("old-visitor"));
});

it("gains the second bed, empty, and leaves the first bed's plots where they were", async () => {
  const plots = await readPlots(app.url);
  expect(plots.map((p) => p.position)).toEqual([...Array(50).keys()]);
  expect(plots.filter((p) => p.position >= 25).every((p) => p.state === "empty")).toBe(true);
  expect(plots.filter((p) => p.state !== "empty").map((p) => p.position)).toEqual([3]);
});

it("still lets the migrated garden take a new kind of plant", async () => {
  const { status, body } = await newVisitor(app.url).post(4, "plant", { type: "flower" });
  expect(status).toBe(200);
  expect(body.plantType).toBe("flower");
});
