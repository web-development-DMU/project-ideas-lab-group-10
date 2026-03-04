import { serve } from "@std/http";
import { dirname, fromFileUrl, join, extname } from "@std/path";
import {
  addNote,
  createRequest,
  dbPath,
  getDb,
  listNotes,
  listRequests,
  updateStatus,
} from "./src/db.js";

const ROOT = dirname(fromFileUrl(import.meta.url)); // .../teams/the-four-loop
const PROJECT_ROOT = join(ROOT, "..", ".."); // project root (so /teams/... works)

const PORT = 8000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function bad(msg, status = 400) {
  return json({ ok: false, error: msg }, status);
}

async function readBody(req) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function serveStatic(urlPath) {
  // Serve from project root, so /teams/the-four-loop/requests.html works
  let filePath = join(PROJECT_ROOT, urlPath);

  // If requesting folder, default index.html
  if (urlPath.endsWith("/")) filePath = join(filePath, "index.html");

  try {
    const data = await Deno.readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    return new Response(data, {
      status: 200,
      headers: { "content-type": MIME[ext] ?? "application/octet-stream" },
    });
  } catch {
    return null;
  }
}

console.log("✅ DB ready at:", dbPath());
getDb(); // ensure created
console.log(`🚀 Listening on http://localhost:${PORT}`);

serve(async (req) => {
  const url = new URL(req.url);

  // Nice default
  if (url.pathname === "/") {
    return Response.redirect(`http://localhost:${PORT}/teams/the-four-loop/requests.html`, 302);
  }

  // -----------------------
  // API
  // -----------------------
  if (url.pathname === "/api/health") {
    return json({ ok: true, db: dbPath() });
  }

  if (url.pathname === "/api/requests" && req.method === "GET") {
    const customer_id = url.searchParams.get("customer_id");
    const data = listRequests({ customer_id: customer_id ? Number(customer_id) : null });
    return json({ ok: true, data });
  }

  if (url.pathname === "/api/requests" && req.method === "POST") {
    const body = await readBody(req);
    if (!body) return bad("Invalid JSON");

    // required
    if (!body.customer_name || !body.item_name) return bad("Missing customer_name or item_name");

    const created = createRequest(body);
    return json({ ok: true, created }, 201);
  }

  // PATCH /api/requests/:id/status
  const statusMatch = url.pathname.match(/^\/api\/requests\/(\d+)\/status$/);
  if (statusMatch && req.method === "PATCH") {
    const request_id = Number(statusMatch[1]);
    const body = await readBody(req);
    if (!body?.status_name) return bad("Missing status_name");

    try {
      updateStatus({ request_id, status_name: body.status_name });
      return json({ ok: true });
    } catch (e) {
      return bad(e.message, 400);
    }
  }

  // GET /api/requests/:id/notes
  const notesMatch = url.pathname.match(/^\/api\/requests\/(\d+)\/notes$/);
  if (notesMatch && req.method === "GET") {
    const request_id = Number(notesMatch[1]);
    return json({ ok: true, data: listNotes({ request_id }) });
  }

  // POST /api/requests/:id/notes
  if (notesMatch && req.method === "POST") {
    const request_id = Number(notesMatch[1]);
    const body = await readBody(req);
    if (!body?.note_text) return bad("Missing note_text");

    addNote({ request_id, note_text: body.note_text });
    return json({ ok: true }, 201);
  }

  // -----------------------
  // Static
  // -----------------------
  const staticRes = await serveStatic(url.pathname);
  if (staticRes) return staticRes;

  return new Response("Not Found", { status: 404 });
}, { port: PORT });