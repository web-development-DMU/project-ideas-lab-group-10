import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

export const db = new Database("./sourceflow.sqlite");

export function initDb() {
  const schema = `
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS statuses (
      status_id INTEGER PRIMARY KEY,
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
      FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
      FOREIGN KEY (status_id) REFERENCES statuses(status_id)
    );

    CREATE TABLE IF NOT EXISTS request_notes (
      note_id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (request_id) REFERENCES requests(request_id) ON DELETE CASCADE
    );
  `;

  db.exec(schema);
}

export function seedDb() {
  // statuses
  const countStatuses = db.prepare(`SELECT COUNT(*) AS n FROM statuses`).get().n;
  if (countStatuses === 0) {
    const ins = db.prepare(`INSERT INTO statuses (status_id, status_name) VALUES (?, ?)`);
    ins.run(1, "New");
    ins.run(2, "In Progress");
    ins.run(3, "Sourced");
    ins.run(4, "Completed");
  }

  // demo customer
  const countCustomers = db.prepare(`SELECT COUNT(*) AS n FROM customers`).get().n;
  if (countCustomers === 0) {
    db.prepare(`
      INSERT INTO customers (full_name, email, phone, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run("Demo Customer", "demo@sourceflow.local", "0000000000");
  }
}