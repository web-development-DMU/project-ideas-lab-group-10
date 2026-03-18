import { extname } from "@std/path";
import {
  addNote,
  createRequest,
  getDb,
  getDbPath,
  listNotesForRequest,
  listRequests,
  updateRequestStatus,
} from "./src/db.js";

const PORT = 8000;
const ROOT = new URL(".", import.meta.url);

// Initialise DB
getDb();

console.log("DB ready at:", getDbPath());
console.log(`Server running at http://localhost:${PORT}/`);

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  try {
    // ---------------- API ----------------
    if (pathname.startsWith("/api/")) {
      return handleApi(req, pathname);
    }

    // ---------------- STATIC ----------------
    return serveStatic(pathname);
  } catch (err) {
    console.error("SERVER ERROR:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
});

// ---------------- API HANDLER ----------------
async function handleApi(req, pathname) {
  if (req.method === "GET" && pathname === "/api/requests") {
    return json({ ok: true, data: listRequests() });
  }

  if (req.method === "POST" && pathname === "/api/requests") {
    const body = await safeJson(req);

    const created = createRequest({
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      item_name: body.item_name,
      brand: body.brand,
      budget_gbp: body.budget_gbp,
      size: body.size,
      colour: body.colour,
    });

    return json({ ok: true, data: created }, 201);
  }

  const match = pathname.match(/^\/api\/requests\/(\d+)\/status$/);
  if (req.method === "PATCH" && match) {
    const id = Number(match[1]);
    const body = await safeJson(req);

    updateRequestStatus(id, body.status_name);

    return json({ ok: true });
  }

  return json({ ok: false, error: "Not found" }, 404);
}

// ---------------- STATIC ----------------
async function serveStatic(pathname) {
  let path = pathname;

  if (path === "/") path = "/app/index.html";

  const fileUrl = new URL("." + path, ROOT);

  try {
    const data = await Deno.readFile(fileUrl);

    return new Response(data, {
      headers: { "content-type": getType(path) },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

// ---------------- HELPERS ----------------
function getType(path) {
  const map = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
  };

  return map[extname(path)] || "text/plain";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function safeJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}