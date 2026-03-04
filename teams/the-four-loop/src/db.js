import { DB } from "sqlite";
import { dirname, fromFileUrl, join } from "@std/path";

const ROOT = dirname(fromFileUrl(import.meta.url)); // .../teams/the-four-loop/src
const DB_PATH = join(ROOT, "..", "data", "sourceflow.db");

let db;

export function getDb() {
  if (db) return db;

  db = new DB(DB_PATH);

  // Schema
  db.execute(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS statuses (
      status_id INTEGER PRIMARY KEY AUTOINCREMENT,
      status_name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      status_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      brand TEXT,
      budget_gbp REAL,
      size TEXT,
      colour TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(customer_id),
      FOREIGN KEY(status_id) REFERENCES statuses(status_id)
    );

    CREATE TABLE IF NOT EXISTS request_notes (
      note_id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(request_id) REFERENCES requests(request_id)
    );
  `);

  // -----------------------
  // Seed statuses
  // -----------------------
  const existing = db.query("SELECT COUNT(*) as c FROM statuses")[0][0];

  if (existing === 0) {
    db.query("INSERT INTO statuses(status_name) VALUES (?)", ["New"]);
    db.query("INSERT INTO statuses(status_name) VALUES (?)", ["In Progress"]);
    db.query("INSERT INTO statuses(status_name) VALUES (?)", ["Sourced"]);
    db.query("INSERT INTO statuses(status_name) VALUES (?)", ["Completed"]);
  }

  // -----------------------
  // STEP 2: Seed demo rows
  // -----------------------
  const reqCount = db.query("SELECT COUNT(*) FROM requests")[0][0];

  if (reqCount === 0) {
    // Demo customers
    db.query("INSERT INTO customers(full_name, email) VALUES (?, ?)", [
      "Aisha Khan",
      "aisha@example.com",
    ]);
    const c1 = db.lastInsertRowId;

    db.query("INSERT INTO customers(full_name, email) VALUES (?, ?)", [
      "Daniel Smith",
      "daniel@example.com",
    ]);
    const c2 = db.lastInsertRowId;

    db.query("INSERT INTO customers(full_name, email) VALUES (?, ?)", [
      "Mariam Yusuf",
      "mariam@example.com",
    ]);
    const c3 = db.lastInsertRowId;

    // Get status IDs
    const sNew = db.query(
      "SELECT status_id FROM statuses WHERE status_name = 'New'",
    )[0][0];

    const sProg = db.query(
      "SELECT status_id FROM statuses WHERE status_name = 'In Progress'",
    )[0][0];

    const sSourced = db.query(
      "SELECT status_id FROM statuses WHERE status_name = 'Sourced'",
    )[0][0];

    const sDone = db.query(
      "SELECT status_id FROM statuses WHERE status_name = 'Completed'",
    )[0][0];

    const ts = nowIso();

    // Demo requests
    db.query(
      `INSERT INTO requests
        (customer_id, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c1, sNew, "Prada Re-Edition Bag", "Prada", 1200, "One Size", "Black", ts, ts],
    );
    const r1 = db.lastInsertRowId;

    db.query(
      `INSERT INTO requests
        (customer_id, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c2, sProg, "Tech Fleece Set", "Nike", 180, "M", "Grey", ts, ts],
    );
    const r2 = db.lastInsertRowId;

    db.query(
      `INSERT INTO requests
        (customer_id, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c3, sNew, 'MacBook Pro 14"', "Apple", 1800, "N/A", "Space Black", ts, ts],
    );
    const r3 = db.lastInsertRowId;

    db.query(
      `INSERT INTO requests
        (customer_id, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c1, sDone, "Airwrap", "Dyson", 450, "N/A", "Nickel/Copper", ts, ts],
    );
    const r4 = db.lastInsertRowId;

    db.query(
      `INSERT INTO requests
        (customer_id, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c2, sSourced, "Wyndham Parka", "Canada Goose", 900, "L", "Black", ts, ts],
    );
    const r5 = db.lastInsertRowId;

    // Demo notes
    db.query(
      "INSERT INTO request_notes(request_id, note_text, created_at) VALUES (?, ?, ?)",
      [r1, "Request received. Starting sourcing.", ts],
    );

    db.query(
      "INSERT INTO request_notes(request_id, note_text, created_at) VALUES (?, ?, ?)",
      [r2, "Found options. Awaiting approval.", ts],
    );

    db.query(
      "INSERT INTO request_notes(request_id, note_text, created_at) VALUES (?, ?, ?)",
      [r5, "Budget mismatch — suggested alternatives.", ts],
    );
  }

  return db;
}

export function dbPath() {
  return DB_PATH;
}

export function nowIso() {
  return new Date().toISOString();
}

export function upsertCustomer({ full_name, email }) {
  const db = getDb();

  // Try find by email if provided, else by name
  if (email) {
    const found = db.query(
      "SELECT customer_id FROM customers WHERE email = ?",
      [email],
    );
    if (found.length) return found[0][0];
  }

  const foundByName = db.query(
    "SELECT customer_id FROM customers WHERE full_name = ?",
    [full_name],
  );

  if (foundByName.length) return foundByName[0][0];

  db.query("INSERT INTO customers(full_name, email) VALUES (?, ?)", [
    full_name,
    email ?? null,
  ]);

  return db.lastInsertRowId;
}

export function listRequests({ customer_id = null } = {}) {
  const db = getDb();

  const base = `
    SELECT
      r.request_id,
      c.full_name AS customer_name,
      c.email AS customer_email,
      r.item_name,
      r.brand,
      r.budget_gbp,
      r.size,
      r.colour,
      s.status_name,
      r.created_at,
      r.updated_at
    FROM requests r
    JOIN customers c ON c.customer_id = r.customer_id
    JOIN statuses s ON s.status_id = r.status_id
  `;

  const rows = customer_id
    ? db.query(base + " WHERE r.customer_id = ? ORDER BY r.request_id DESC", [
        customer_id,
      ])
    : db.query(base + " ORDER BY r.request_id DESC");

  return rows.map((row) => ({
    request_id: row[0],
    customer_name: row[1],
    customer_email: row[2],
    item_name: row[3],
    brand: row[4],
    budget_gbp: row[5],
    size: row[6],
    colour: row[7],
    status_name: row[8],
    created_at: row[9],
    updated_at: row[10],
  }));
}

export function createRequest(payload) {
  const db = getDb();

  const customer_id = upsertCustomer({
    full_name: payload.customer_name,
    email: payload.customer_email,
  });

  const statusRow = db.query(
    "SELECT status_id FROM statuses WHERE status_name = 'New'",
  );
  const status_id = statusRow[0][0];

  const ts = nowIso();

  db.query(
    `INSERT INTO requests
      (customer_id, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customer_id,
      status_id,
      payload.item_name,
      payload.brand ?? null,
      payload.budget_gbp ?? null,
      payload.size ?? null,
      payload.colour ?? null,
      ts,
      ts,
    ],
  );

  return { request_id: db.lastInsertRowId, customer_id };
}

export function updateStatus({ request_id, status_name }) {
  const db = getDb();

  const s = db.query(
    "SELECT status_id FROM statuses WHERE status_name = ?",
    [status_name],
  );

  if (!s.length) throw new Error("Unknown status");

  const status_id = s[0][0];

  db.query(
    "UPDATE requests SET status_id = ?, updated_at = ? WHERE request_id = ?",
    [status_id, nowIso(), request_id],
  );
}

export function addNote({ request_id, note_text }) {
  const db = getDb();

  db.query(
    "INSERT INTO request_notes(request_id, note_text, created_at) VALUES (?, ?, ?)",
    [request_id, note_text, nowIso()],
  );
}

export function listNotes({ request_id }) {
  const db = getDb();

  const rows = db.query(
    "SELECT note_id, note_text, created_at FROM request_notes WHERE request_id = ? ORDER BY note_id DESC",
    [request_id],
  );

  return rows.map((r) => ({
    note_id: r[0],
    note_text: r[1],
    created_at: r[2],
  }));
}