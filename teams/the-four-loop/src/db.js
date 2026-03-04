// teams/the-four-loop/src/db.js
import { DatabaseSync } from "node:sqlite";
import { dirname, fromFileUrl, join } from "@std/path";

const ROOT = dirname(fromFileUrl(import.meta.url)); // .../teams/the-four-loop/src
const DATA_DIR = join(ROOT, "..", "data");
const DB_PATH = join(DATA_DIR, "sourceflow.db");

let db;

export function getDb() {
  if (db) return db;

  // Ensure /data exists
  Deno.mkdirSync(DATA_DIR, { recursive: true });

  // Open or create DB
  db = new DatabaseSync(DB_PATH);

  // Schema
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS statuses (
      status_id INTEGER PRIMARY KEY AUTOINCREMENT,
      status_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      status_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      brand TEXT,
      budget_gbp REAL,
      size TEXT,
      colour TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (status_id) REFERENCES statuses(status_id)
    );

    CREATE TABLE IF NOT EXISTS request_notes (
      note_id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES requests(request_id) ON DELETE CASCADE
    );
  `);

  seedStatuses();
  return db;
}

export function getDbPath() {
  return DB_PATH;
}

export function getStatusIdByName(statusName) {
  const row = db
    .prepare("SELECT status_id FROM statuses WHERE status_name = ?;")
    .all(statusName)?.[0];

  if (!row) throw new Error(`Unknown status: ${statusName}`);
  return row.status_id;
}

function seedStatuses() {
  const row = db.prepare("SELECT COUNT(*) AS c FROM statuses;").all()?.[0];
  const count = row?.c ?? 0;
  if (count > 0) return;

  const insert = db.prepare("INSERT INTO statuses (status_name) VALUES (?);");
  ["New", "In Progress", "Sourced", "Completed"].forEach((s) => insert.run(s));
}