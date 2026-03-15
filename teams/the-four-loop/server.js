import { getDb, getDbPath, getStatusIdByName } from "./src/db.js";
import { extname } from "@std/path";

const PORT = 8000;
const ROOT = new URL(".", import.meta.url);

getDb();
console.log("DB ready at:", getDbPath());
console.log(`Listening on http://localhost:${PORT}/`);

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.startsWith("/api/")) return handleApi(req, url);
  return serveStatic(path);
});

async function handleApi(req, url) {
  const db = getDb();
  const path = url.pathname;

  if (req.method === "GET" && path === "/api/health") {
    return json({ ok: true, db: getDbPath() });
  }

  if (req.method === "GET" && path === "/api/requests") {
    const rows = db.prepare(`
      SELECT
        r.request_id,
        r.customer_name,
        r.customer_email,
        r.item_name,
        r.brand,
        r.budget_gbp,
        r.size,
        r.colour,
        s.status_name,
        r.created_at,
        r.updated_at
      FROM requests r
      JOIN statuses s ON s.status_id = r.status_id
      ORDER BY r.request_id DESC
    `).all();

    return json(rows);
  }

  if (req.method === "POST" && path === "/api/requests") {
    const body = await safeJson(req);

    const customer_name = (body.customer_name ?? "").trim();
    const customer_email = (body.customer_email ?? "").trim() || null;
    const item_name = (body.item_name ?? "").trim();
    const brand = (body.brand ?? "").trim() || null;
    const budget_gbp = body.budget_gbp === "" || body.budget_gbp == null ? null : Number(body.budget_gbp);
    const size = (body.size ?? "").trim() || null;
    const colour = (body.colour ?? "").trim() || null;

    if (!customer_name || !item_name) {
      return json({ error: "customer_name and item_name are required" }, 400);
    }

    const now = new Date().toISOString();
    const status_id = getStatusIdByName("New");

    db.prepare(`
      INSERT INTO requests (
        customer_name, customer_email, item_name, brand, budget_gbp,
        size, colour, status_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer_name,
      customer_email,
      item_name,
      brand,
      budget_gbp,
      size,
      colour,
      status_id,
      now,
      now
    );

    const created = db.prepare(`
      SELECT
        r.request_id,
        r.customer_name,
        r.customer_email,
        r.item_name,
        r.brand,
        r.budget_gbp,
        r.size,
        r.colour,
        s.status_name,
        r.created_at
      FROM requests r
      JOIN statuses s ON s.status_id = r.status_id
      WHERE r.request_id = last_insert_rowid()
    `).get();

    return json(created, 201);
  }

  const statusMatch = path.match(/^\/api\/requests\/(\d+)\/status$/);
  if (req.method === "PATCH" && statusMatch) {
    const request_id = Number(statusMatch[1]);
    const body = await safeJson(req);
    const status_name = (body.status_name ?? "").trim();
    if (!status_name) return json({ error: "status_name is required" }, 400);

    const status_id = getStatusIdByName(status_name);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE requests
      SET status_id = ?, updated_at = ?
      WHERE request_id = ?
    `).run(status_id, now, request_id);

    return json({ ok: true });
  }

  return json({ error: "Not found" }, 404);
}

async function serveStatic(pathname) {
  let rel = pathname;

  if (rel === "/") rel = "/app/index.html";
  if (rel.includes("..")) return new Response("Bad request", { status: 400 });

  const fileUrl = new URL("." + rel, ROOT);

  try {
    const data = await Deno.readFile(fileUrl);
    return new Response(data, {
      headers: { "content-type": contentType(rel) }
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

function contentType(path) {
  const ext = extname(path).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  }[ext] || "application/octet-stream");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

async function safeJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}