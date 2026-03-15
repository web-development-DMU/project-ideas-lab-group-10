import { DatabaseSync } from "node:sqlite";
import { dirname, fromFileUrl, join } from "@std/path";

const ROOT = dirname(fromFileUrl(import.meta.url));
const DATA_DIR = join(ROOT, "..", "data");
const DB_PATH = join(DATA_DIR, "sourceflow.db");

let db;

export function getDb() {
  if (db) return db;

  Deno.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS statuses (
      status_id INTEGER PRIMARY KEY AUTOINCREMENT,
      status_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_email TEXT,
      item_name TEXT NOT NULL,
      brand TEXT,
      budget_gbp REAL,
      size TEXT,
      colour TEXT,
      status_id INTEGER NOT NULL,
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

  const count = db.prepare("SELECT COUNT(*) AS c FROM statuses").get().c;
  if (count === 0) {
    const stmt = db.prepare("INSERT INTO statuses(status_name) VALUES (?)");
    ["New", "In Progress", "Sourced", "Completed"].forEach((s) => stmt.run(s));
  }

  return db;
}

export function getDbPath() {
  return DB_PATH;
}

export function getStatusIdByName(name) {
  const row = getDb().prepare("SELECT status_id FROM statuses WHERE status_name = ?").get(name);
  if (!row) throw new Error(`Unknown status: ${name}`);
  return row.status_id;
}