import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { extname, join, dirname, fromFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts";
import { ensureDir } from "https://deno.land/std@0.224.0/fs/ensure_dir.ts";
import {
  openDb,
  listRequests,
  createRequest,
  updateStatus,
  addNote,
  deleteRequest,
} from "./src/db.js";

const __dirname = dirname(fromFileUrl(import.meta.url));

// DB location: teams/the-four-loop/data/sourceflow.db
const dataDir = join(__dirname, "data");
await ensureDir(dataDir);
const dbPath = join(dataDir, "sourceflow.db");

const db = openDb(dbPath);
console.log("✅ DB ready at:", dbPath);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

// Serve static files from the REPO ROOT so /teams/... works
async function serveStatic(urlPath) {
  const repoRoot = join(__dirname, "..", "..");
  const filePath = join(repoRoot, urlPath);

  try {
    const file = await Deno.readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    return new Response(file, {
      status: 200,
      headers: { "content-type": MIME[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

serve(async (req) => {
  const url = new URL(req.url);

  // Friendly redirects
  if (url.pathname === "/") {
    return Response.redirect(`${url.origin}/teams/the-four-loop/index.html`, 302);
  }
  if (url.pathname === "/requests.html") {
    return Response.redirect(`${url.origin}/teams/the-four-loop/requests.html`, 302);
  }

  // API
  if (url.pathname === "/api/health") {
    return json({ ok: true, db: dbPath });
  }

  if (url.pathname === "/api/requests" && req.method === "GET") {
    return json({ ok: true, requests: listRequests(db) });
  }

  if (url.pathname === "/api/requests" && req.method === "POST") {
    const payload = await req.json();
    if (!payload?.item_name || String(payload.item_name).trim().length < 2) {
      return json({ ok: false, error: "item_name is required (min 2 chars)" }, 400);
    }
    const id = createRequest(db, payload);
    return json({ ok: true, request_id: id }, 201);
  }

  if (url.pathname === "/api/requests/status" && req.method === "POST") {
    const { request_id, status_name } = await req.json();
    if (!request_id || !status_name) {
      return json({ ok: false, error: "request_id + status_name required" }, 400);
    }
    updateStatus(db, Number(request_id), String(status_name));
    return json({ ok: true });
  }

  if (url.pathname === "/api/requests/note" && req.method === "POST") {
    const { request_id, note_text } = await req.json();
    if (!request_id || !note_text) {
      return json({ ok: false, error: "request_id + note_text required" }, 400);
    }
    addNote(db, Number(request_id), String(note_text));
    return json({ ok: true });
  }

  if (url.pathname === "/api/requests/delete" && req.method === "POST") {
    const { request_id } = await req.json();
    if (!request_id) return json({ ok: false, error: "request_id required" }, 400);
    deleteRequest(db, Number(request_id));
    return json({ ok: true });
  }

  // Static
  return await serveStatic(url.pathname);
}, { port: 8000 });

console.log("✅ Listening on http://localhost:8000");