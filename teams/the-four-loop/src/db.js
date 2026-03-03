import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

export function openDb(dbFilePath) {
  const db = new DB(dbFilePath);

  db.execute(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS statuses (
      status_id INTEGER PRIMARY KEY AUTOINCREMENT,
      status_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      status_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      brand TEXT,
      budget_gbp REAL,
      size TEXT,
      colour TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
      FOREIGN KEY (status_id) REFERENCES statuses(status_id)
    );

    CREATE TABLE IF NOT EXISTS request_notes (
      note_id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (request_id) REFERENCES requests(request_id) ON DELETE CASCADE
    );
  `);

  // Seed statuses
  for (const s of ["New", "In Progress", "Sourced", "Completed"]) {
    db.query(`INSERT OR IGNORE INTO statuses(status_name) VALUES (?)`, [s]);
  }

  return db;
}

export function listRequests(db) {
  const rows = db.query(`
    SELECT
      r.request_id,
      r.item_name,
      r.brand,
      r.budget_gbp,
      r.size,
      r.colour,
      r.created_at,
      r.updated_at,
      s.status_name
    FROM requests r
    JOIN statuses s ON s.status_id = r.status_id
    ORDER BY r.request_id DESC
  `);

  return rows.map((r) => ({
    request_id: r[0],
    item_name: r[1],
    brand: r[2],
    budget_gbp: r[3],
    size: r[4],
    colour: r[5],
    created_at: r[6],
    updated_at: r[7],
    status_name: r[8],
  }));
}

export function createRequest(db, payload) {
  const {
    item_name,
    brand = null,
    budget_gbp = null,
    size = null,
    colour = null,
  } = payload;

  const statusRow = db.query(
    `SELECT status_id FROM statuses WHERE status_name='New' LIMIT 1`,
  );
  const newStatusId = statusRow[0][0];

  db.query(
    `INSERT INTO requests (status_id, item_name, brand, budget_gbp, size, colour)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newStatusId, item_name, brand, budget_gbp, size, colour],
  );

  const [[id]] = db.query(`SELECT last_insert_rowid()`);
  return id;
}

export function updateStatus(db, requestId, statusName) {
  const rows = db.query(
    `SELECT status_id FROM statuses WHERE status_name=? LIMIT 1`,
    [statusName],
  );
  if (rows.length === 0) throw new Error("Unknown status");

  const statusId = rows[0][0];

  db.query(
    `UPDATE requests
     SET status_id=?, updated_at=datetime('now')
     WHERE request_id=?`,
    [statusId, requestId],
  );
}

export function addNote(db, requestId, noteText) {
  db.query(
    `INSERT INTO request_notes (request_id, note_text) VALUES (?, ?)`,
    [requestId, noteText],
  );
}

export function deleteRequest(db, requestId) {
  db.query(`DELETE FROM requests WHERE request_id=?`, [requestId]);
}