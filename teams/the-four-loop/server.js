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

getDb();
console.log("DB ready at:", getDbPath());
console.log(`Listening on http://localhost:${PORT}/`);

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    return handleApi(req, pathname);
  }

  return serveStatic(pathname);
});

async function handleApi(req, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/health") {
      return json({ ok: true, db: getDbPath() });
    }

    if (req.method === "GET" && pathname === "/api/requests") {
      return json({ ok: true, data: listRequests() });
    }

    if (req.method === "POST" && pathname === "/api/requests") {
      const body = await safeJson(req);

      const payload = {
        customer_name: String(body.customer_name ?? "").trim(),
        customer_email: String(body.customer_email ?? "").trim() || null,
        item_name: String(body.item_name ?? "").trim(),
        brand: String(body.brand ?? "").trim() || null,
        budget_gbp: body.budget_gbp === "" || body.budget_gbp == null
          ? null
          : Number(body.budget_gbp),
        size: String(body.size ?? "").trim() || null,
        colour: String(body.colour ?? "").trim() || null,
      };

      if (!payload.customer_name) {
        return json({ ok: false, error: "Customer name is required." }, 400);
      }

      if (!payload.item_name) {
        return json({ ok: false, error: "Item name is required." }, 400);
      }

      if (
        payload.budget_gbp !== null &&
        (Number.isNaN(payload.budget_gbp) || payload.budget_gbp < 0)
      ) {
        return json({ ok: false, error: "Budget must be a valid number." }, 400);
      }

      const created = createRequest(payload);
      return json({ ok: true, data: created }, 201);
    }

    const statusMatch = pathname.match(/^\/api\/requests\/(\d+)\/status$/);
    if (req.method === "PATCH" && statusMatch) {
      const requestId = Number(statusMatch[1]);
      const body = await safeJson(req);
      const statusName = String(body.status_name ?? "").trim();

      if (!statusName) {
        return json({ ok: false, error: "status_name is required." }, 400);
      }

      updateRequestStatus(requestId, statusName);
      return json({ ok: true });
    }

    const notesGetMatch = pathname.match(/^\/api\/requests\/(\d+)\/notes$/);
    if (req.method === "GET" && notesGetMatch) {
      const requestId = Number(notesGetMatch[1]);
      return json({ ok: true, data: listNotesForRequest(requestId) });
    }

    const notesPostMatch = pathname.match(/^\/api\/requests\/(\d+)\/notes$/);
    if (req.method === "POST" && notesPostMatch) {
      const requestId = Number(notesPostMatch[1]);
      const body = await safeJson(req);
      const noteText = String(body.note_text ?? "").trim();

      if (!noteText) {
        return json({ ok: false, error: "note_text is required." }, 400);
      }

      addNote(requestId, noteText);
      return json({ ok: true });
    }

    return json({ ok: false, error: "Not found." }, 404);
  } catch (error) {
    console.error("API error:", error);
    return json(
      {
        ok: false,
        error: error?.message || "Internal server error.",
      },
      500,
    );
  }
}

async function serveStatic(pathname) {
  let resolvedPath = pathname;

  if (resolvedPath === "/") {
    return Response.redirect("http://localhost:8000/app/index.html", 302);
  }

  if (resolvedPath.includes("..")) {
    return new Response("Bad request", { status: 400 });
  }

  const fileUrl = new URL("." + resolvedPath, ROOT);

  try {
    const data = await Deno.readFile(fileUrl);
    return new Response(data, {
      status: 200,
      headers: { "content-type": getContentType(resolvedPath) },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

function getContentType(pathname) {
  const extension = extname(pathname).toLowerCase();

  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  };

  return types[extension] || "application/octet-stream";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

async function safeJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}