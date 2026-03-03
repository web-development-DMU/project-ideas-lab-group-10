import { join, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

function nowISO() {
  return new Date().toISOString();
}

export async function openDb() {
  // ROOT = folder where server.js lives (teams/the-four-loop/)
  const ROOT = fromFileUrl(new URL("../", import.meta.url));
  const DATA_DIR = join(ROOT, "data");
  await ensureDir(DATA_DIR);

  const DB_PATH = join(DATA_DIR, "sourceflow.db");

  // Opening SQLite creates the file if it doesn't exist
  const db = new DB(DB_PATH);

  // Tables
  db.execute(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name   TEXT NOT NULL,
      email       TEXT,
      phone       TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS statuses (
      status_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      status_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS requests (
      request_id   INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id  INTEGER,
      status_id    INTEGER NOT NULL,
      item_name    TEXT NOT NULL,
      brand        TEXT,
      budget_gbp   REAL,
      size         TEXT,
      colour       TEXT,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE SET NULL,
      FOREIGN KEY (status_id)   REFERENCES statuses(status_id)
    );

    CREATE TABLE IF NOT EXISTS request_notes (
      note_id     INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id  INTEGER NOT NULL,
      note_text   TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES requests(request_id) ON DELETE CASCADE
    );
  `);

  // Seed statuses (idempotent)
  const defaultStatuses = ["New", "In Progress", "Sourced", "Completed"];
  for (const s of defaultStatuses) {
    db.query("INSERT OR IGNORE INTO statuses (status_name) VALUES (?);", [s]);
  }

  return { db, DB_PATH, nowISO };
}