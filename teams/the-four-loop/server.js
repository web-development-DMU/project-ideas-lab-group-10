import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { join, extname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";
import { contentType } from "https://deno.land/std@0.224.0/media_types/mod.ts";
import { openDb } from "./src/db.js";

const ROOT = fromFileUrl(new URL("./", import.meta.url));
const { db, DB_PATH, nowISO } = await openDb();

console.log("✅ DB ready at:", DB_PATH);

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function readBody(req) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await req.json();
  if (ct.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    return Object.fromEntries(params.entries());
  }
  // fallback
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function firstStatusId() {
  const row = [...db.query("SELECT status_id FROM statuses WHERE status_name='New' LIMIT 1;")][0];
  return row?.[0] ?? 1;
}

function toRequestRow(row) {
  return {
    request_id: row[0],
    customer_id: row[1],
    status_id: row[2],
    status_name: row[3],
    item_name: row[4],
    brand: row[5],
    budget_gbp: row[6],
    size: row[7],
    colour: row[8],
    created_at: row[9],
    updated_at: row[10],
  };
}

async function serveStatic(pathname) {
  // Map URL → file
  // default doc
  if (pathname === "/") pathname = "/index.html";

  const filePath = join(ROOT, pathname);

  try {
    const file = await Deno.readFile(filePath);
    const type = contentType(extname(filePath)) || "application/octet-stream";
    return new Response(file, { headers: { "content-type": type } });
  } catch {
    return null;
  }
}

serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // ---------------------------
  // API ROUTES
  // ---------------------------
  if (pathname === "/api/health") {
    return json({ ok: true, db: DB_PATH });
  }

  if (pathname === "/api/statuses" && req.method === "GET") {
    const rows = [...db.query("SELECT status_id, status_name FROM statuses ORDER BY status_id;")];
    return json(rows.map((r) => ({ status_id: r[0], status_name: r[1] })));
  }

  // GET all requests
  if (pathname === "/api/requests" && req.method === "GET") {
    const rows = [
      ...db.query(`
        SELECT r.request_id, r.customer_id, r.status_id, s.status_name,
               r.item_name, r.brand, r.budget_gbp, r.size, r.colour,
               r.created_at, r.updated_at
        FROM requests r
        JOIN statuses s ON s.status_id = r.status_id
        ORDER BY r.updated_at DESC;
      `),
    ];
    return json(rows.map(toRequestRow));
  }

  // POST create request
  if (pathname === "/api/requests" && req.method === "POST") {
    const body = await readBody(req);

    const item_name = (body.item_name || "").trim();
    if (!item_name) return json({ error: "item_name is required" }, 400);

    const brand = (body.brand || "").trim() || null;
    const size = (body.size || "").trim() || null;
    const colour = (body.colour || "").trim() || null;

    const budget_gbp_raw = body.budget_gbp ?? body.budget ?? "";
    const budget_gbp = budget_gbp_raw === "" ? null : Number(budget_gbp_raw);

    const created_at = nowISO();
    const updated_at = created_at;

    const status_id = firstStatusId();

    db.query(
      `INSERT INTO requests (customer_id, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [null, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at],
    );

    const id = [...db.query("SELECT last_insert_rowid();")][0][0];
    return json({ ok: true, request_id: id }, 201);
  }

  // PATCH update status
  if (pathname.startsWith("/api/requests/") && pathname.endsWith("/status") && req.method === "PATCH") {
    const parts = pathname.split("/");
    const requestId = Number(parts[3]);
    if (!Number.isFinite(requestId)) return json({ error: "invalid request id" }, 400);

    const body = await readBody(req);
    const status_id = Number(body.status_id);
    if (!Number.isFinite(status_id)) return json({ error: "status_id required" }, 400);

    db.query("UPDATE requests SET status_id=?, updated_at=? WHERE request_id=?;", [status_id, nowISO(), requestId]);
    return json({ ok: true });
  }

  // POST add note
  if (pathname.startsWith("/api/requests/") && pathname.endsWith("/notes") && req.method === "POST") {
    const parts = pathname.split("/");
    const requestId = Number(parts[3]);
    if (!Number.isFinite(requestId)) return json({ error: "invalid request id" }, 400);

    const body = await readBody(req);
    const note_text = (body.note_text || body.note || "").trim();
    if (!note_text) return json({ error: "note_text required" }, 400);

    db.query(
      "INSERT INTO request_notes (request_id, note_text, created_at) VALUES (?, ?, ?);",
      [requestId, note_text, nowISO()],
    );
    db.query("UPDATE requests SET updated_at=? WHERE request_id=?;", [nowISO(), requestId]);

    return json({ ok: true }, 201);
  }

  // GET notes for request
  if (pathname.startsWith("/api/requests/") && pathname.endsWith("/notes") && req.method === "GET") {
    const parts = pathname.split("/");
    const requestId = Number(parts[3]);
    if (!Number.isFinite(requestId)) return json({ error: "invalid request id" }, 400);

    const rows = [
      ...db.query(
        "SELECT note_id, request_id, note_text, created_at FROM request_notes WHERE request_id=? ORDER BY created_at DESC;",
        [requestId],
      ),
    ];
    return json(rows.map((r) => ({ note_id: r[0], request_id: r[1], note_text: r[2], created_at: r[3] })));
  }

  // ---------------------------
  // STATIC FILES (HTML/CSS/IMG)
  // ---------------------------
  const staticRes = await serveStatic(pathname);
  if (staticRes) return staticRes;

  return new Response("Not Found", { status: 404 });
});