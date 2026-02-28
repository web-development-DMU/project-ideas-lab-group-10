import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { db, initDb, seedDb } from "./src/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5500;

// Parse form bodies
app.use(express.urlencoded({ extended: true }));

// Serve your existing repo files as static (so /teams/... still works)
app.use(express.static(__dirname));

// Init DB
initDb();
seedDb();

// Home → requests list
app.get("/", (req, res) => {
  res.redirect("/requests");
});

// Requests list
app.get("/requests", (req, res) => {
  const rows = db.prepare(`
    SELECT r.request_id, r.item_name, r.brand, r.budget_gbp, r.size, r.colour,
           s.status_name, r.created_at
    FROM requests r
    JOIN statuses s ON s.status_id = r.status_id
    ORDER BY r.request_id DESC
  `).all();

  res.send(renderLayout("Requests", renderRequestsList(rows)));
});

// New request form (uses your theme)
app.get("/requests/new", (req, res) => {
  const statuses = db.prepare(`SELECT status_id, status_name FROM statuses ORDER BY status_id`).all();
  res.send(renderLayout("New Request", renderNewRequestForm(statuses)));
});

// Create request
app.post("/requests", (req, res) => {
  const { item_name, brand, budget_gbp, size, colour, status_id, notes } = req.body;

  if (!item_name || item_name.trim().length < 2) {
    return res.status(400).send(renderLayout("Error", `<p>Item name is required.</p><p><a href="/requests/new">Back</a></p>`));
  }

  // Demo customer: customer_id = 1
  const insert = db.prepare(`
    INSERT INTO requests (customer_id, status_id, item_name, brand, budget_gbp, size, colour, created_at, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  const result = insert.run(
    Number(status_id || 1),
    item_name.trim(),
    (brand || "").trim(),
    budget_gbp ? Number(budget_gbp) : null,
    (size || "").trim(),
    (colour || "").trim()
  );

  // Optional note
  const noteText = (notes || "").trim();
  if (noteText) {
    db.prepare(`
      INSERT INTO request_notes (request_id, note_text, created_at)
      VALUES (?, ?, datetime('now'))
    `).run(result.lastInsertRowid, noteText);
  }

  res.redirect(`/requests/${result.lastInsertRowid}`);
});

// Request detail
app.get("/requests/:id", (req, res) => {
  const id = Number(req.params.id);
  const request = db.prepare(`
    SELECT r.*, s.status_name, c.full_name, c.email
    FROM requests r
    JOIN statuses s ON s.status_id = r.status_id
    JOIN customers c ON c.customer_id = r.customer_id
    WHERE r.request_id = ?
  `).get(id);

  if (!request) return res.status(404).send(renderLayout("Not found", `<p>Request not found.</p><p><a href="/requests">Back</a></p>`));

  const notes = db.prepare(`
    SELECT note_id, note_text, created_at
    FROM request_notes
    WHERE request_id = ?
    ORDER BY note_id DESC
  `).all(id);

  res.send(renderLayout(`Request #${id}`, renderRequestDetail(request, notes)));
});

// Edit request
app.get("/requests/:id/edit", (req, res) => {
  const id = Number(req.params.id);
  const request = db.prepare(`SELECT * FROM requests WHERE request_id = ?`).get(id);
  if (!request) return res.status(404).send(renderLayout("Not found", `<p>Request not found.</p>`));

  const statuses = db.prepare(`SELECT status_id, status_name FROM statuses ORDER BY status_id`).all();
  res.send(renderLayout(`Edit Request #${id}`, renderEditForm(request, statuses)));
});

// Update request
app.post("/requests/:id/update", (req, res) => {
  const id = Number(req.params.id);
  const { item_name, brand, budget_gbp, size, colour, status_id, notes } = req.body;

  db.prepare(`
    UPDATE requests
    SET status_id = ?,
        item_name = ?,
        brand = ?,
        budget_gbp = ?,
        size = ?,
        colour = ?,
        updated_at = datetime('now')
    WHERE request_id = ?
  `).run(
    Number(status_id || 1),
    (item_name || "").trim(),
    (brand || "").trim(),
    budget_gbp ? Number(budget_gbp) : null,
    (size || "").trim(),
    (colour || "").trim(),
    id
  );

  const noteText = (notes || "").trim();
  if (noteText) {
    db.prepare(`
      INSERT INTO request_notes (request_id, note_text, created_at)
      VALUES (?, ?, datetime('now'))
    `).run(id, noteText);
  }

  res.redirect(`/requests/${id}`);
});

// Delete request
app.post("/requests/:id/delete", (req, res) => {
  const id = Number(req.params.id);
  db.prepare(`DELETE FROM request_notes WHERE request_id = ?`).run(id);
  db.prepare(`DELETE FROM requests WHERE request_id = ?`).run(id);
  res.redirect("/requests");
});

app.listen(PORT, () => {
  console.log(`SourceFlow running on http://127.0.0.1:${PORT}`);
});

/* -------------------- HTML render helpers -------------------- */

function renderLayout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} — SourceFlow</title>

<link rel="stylesheet" href="/style-example.css" />

<style>
  :root{
    --bg1:#070a12; --bg2:#0b0f19;
    --panel: rgba(255,255,255,0.08);
    --border: rgba(255,255,255,0.16);
    --text: rgba(255,255,255,0.92);
    --muted: rgba(255,255,255,0.72);
    --link: #c7b6ff;
    --shadow: 0 18px 50px rgba(0,0,0,0.35);
    --radius: 18px;
    --radius2: 14px;
    --max: 1100px;
  }
  body{
    margin:0; color:var(--text);
    background:
      radial-gradient(1200px 600px at 20% 10%, rgba(125, 97, 255, 0.25), transparent 55%),
      radial-gradient(900px 500px at 85% 35%, rgba(0, 199, 255, 0.18), transparent 55%),
      linear-gradient(180deg, var(--bg1) 0%, var(--bg2) 50%, var(--bg1) 100%);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .wrap{ max-width: var(--max); margin:0 auto; padding: 22px 18px 60px; }
  .nav{ display:flex; gap:14px; flex-wrap:wrap; margin-bottom:14px; }
  .nav a{ color: var(--link); font-weight:800; text-decoration:underline; }
  .nav a:hover{ color:#fff; }
  .card{
    border:1px solid var(--border);
    background: linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.06));
    box-shadow: var(--shadow);
    border-radius: var(--radius);
    padding: 18px;
  }
  h1{ margin:0 0 10px; letter-spacing:-0.4px; }
  p{ color: var(--muted); line-height:1.55; }
  table{
    width:100%; border-collapse: collapse;
    border:1px solid var(--border);
    background: rgba(0,0,0,0.18);
    border-radius: var(--radius2);
    overflow:hidden;
  }
  th, td{ padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.10); text-align:left; }
  th{ color: rgba(255,255,255,0.85); font-weight: 900; }
  a.btn, button.btn{
    display:inline-flex; align-items:center; justify-content:center;
    padding: 12px 16px; border-radius: 12px;
    border:1px solid var(--border);
    text-decoration:none; font-weight: 900; letter-spacing:0.2px;
    background: rgba(255,255,255,0.10); color: var(--text);
    cursor:pointer;
  }
  a.btn.primary, button.btn.primary{
    background:#fff; color:#0b0f19; border-color: rgba(255,255,255,0.9);
  }
  a.btn:hover, button.btn:hover{ background: rgba(255,255,255,0.14); }
  a.btn.primary:hover, button.btn.primary:hover{ filter: brightness(0.95); }
  .row{ display:flex; gap:10px; flex-wrap:wrap; margin: 10px 0 16px; }
  .muted{ color: var(--muted); }
  .pill{
    display:inline-block; padding: 6px 10px;
    border-radius: 999px; border:1px solid var(--border);
    background: rgba(0,0,0,0.15);
    color: rgba(255,255,255,0.78);
    font-weight: 800;
  }
  .field{
    border:1px solid var(--border);
    background: rgba(0,0,0,0.18);
    border-radius: var(--radius2);
    padding: 12px;
    margin: 10px 0;
  }
  label{ display:block; font-weight: 900; margin-bottom: 6px; }
  input, select, textarea{
    width:100%; box-sizing:border-box;
    padding: 11px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.06);
    color: var(--text);
    outline:none;
  }
  textarea{ min-height: 110px; resize: vertical; }
</style>
</head>
<body>
  <div class="wrap">
    <nav class="nav" aria-label="App navigation">
      <a href="/requests">Requests</a>
      <a href="/requests/new">New Request</a>
      <a href="/teams/the-four-loop/index.html">Team Docs</a>
      <a href="/proposals/the-four-loop.html">Proposal</a>
    </nav>

    <main class="card">
      ${bodyHtml}
    </main>
  </div>
</body>
</html>`;
}

function renderRequestsList(rows) {
  const tr = rows.map(r => `
    <tr>
      <td><a href="/requests/${r.request_id}">#${r.request_id}</a></td>
      <td>${escapeHtml(r.item_name || "")}</td>
      <td>${escapeHtml(r.brand || "")}</td>
      <td class="muted">${r.budget_gbp ?? ""}</td>
      <td class="muted">${escapeHtml(r.size || "")}</td>
      <td class="muted">${escapeHtml(r.colour || "")}</td>
      <td><span class="pill">${escapeHtml(r.status_name)}</span></td>
      <td class="muted">${escapeHtml(r.created_at || "")}</td>
    </tr>
  `).join("");

  return `
    <h1>Requests</h1>
    <p>These are real rows from SQLite. Create a request to see it appear instantly.</p>
    <div class="row">
      <a class="btn primary" href="/requests/new">Create new request</a>
      <a class="btn" href="/teams/the-four-loop/ui.html">UI Documentation</a>
      <a class="btn" href="/teams/the-four-loop/db.html">DB Documentation</a>
    </div>

    <table aria-label="Requests table">
      <thead>
        <tr>
          <th>ID</th><th>Item</th><th>Brand</th><th>Budget</th><th>Size</th><th>Colour</th><th>Status</th><th>Created</th>
        </tr>
      </thead>
      <tbody>
        ${tr || `<tr><td colspan="8" class="muted">No requests yet. Create one.</td></tr>`}
      </tbody>
    </table>
  `;
}

function renderNewRequestForm(statuses) {
  const opts = statuses.map(s => `<option value="${s.status_id}">${escapeHtml(s.status_name)}</option>`).join("");

  return `
    <h1>New Request</h1>
    <p>Submit a sourcing request (stored in SQLite).</p>

    <form action="/requests" method="post" aria-label="Create request form">
      <div class="field">
        <label for="item_name">Item name (required)</label>
        <input id="item_name" name="item_name" required minlength="2" placeholder="e.g., Black Prada loafers" />
      </div>

      <div class="field">
        <label for="brand">Brand</label>
        <input id="brand" name="brand" placeholder="e.g., Prada" />
      </div>

      <div class="field">
        <label for="budget_gbp">Budget (GBP)</label>
        <input id="budget_gbp" name="budget_gbp" type="number" min="0" step="1" placeholder="e.g., 450" />
      </div>

      <div class="field">
        <label for="size">Size</label>
        <input id="size" name="size" placeholder="e.g., UK 7 / EU 41" />
      </div>

      <div class="field">
        <label for="colour">Colour</label>
        <input id="colour" name="colour" placeholder="e.g., Black" />
      </div>

      <div class="field">
        <label for="status_id">Initial status</label>
        <select id="status_id" name="status_id">${opts}</select>
      </div>

      <div class="field">
        <label for="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" placeholder="Any constraints, deadline, preferences..."></textarea>
      </div>

      <div class="row">
        <button class="btn primary" type="submit">Create request</button>
        <a class="btn" href="/requests">Cancel</a>
      </div>
    </form>
  `;
}

function renderRequestDetail(r, notes) {
  const noteList = notes.length
    ? `<ul>${notes.map(n => `<li class="muted">${escapeHtml(n.created_at)} — ${escapeHtml(n.note_text)}</li>`).join("")}</ul>`
    : `<p class="muted">No notes yet.</p>`;

  return `
    <h1>Request #${r.request_id}</h1>
    <p><span class="pill">${escapeHtml(r.status_name)}</span> <span class="muted">Customer: ${escapeHtml(r.full_name)} (${escapeHtml(r.email)})</span></p>

    <div class="row">
      <a class="btn primary" href="/requests/${r.request_id}/edit">Edit</a>
      <a class="btn" href="/requests">Back to list</a>
      <form action="/requests/${r.request_id}/delete" method="post" style="display:inline;">
        <button class="btn" type="submit" onclick="return confirm('Delete this request?')">Delete</button>
      </form>
    </div>

    <p><strong>Item:</strong> ${escapeHtml(r.item_name || "")}</p>
    <p><strong>Brand:</strong> ${escapeHtml(r.brand || "")}</p>
    <p><strong>Budget:</strong> ${r.budget_gbp ?? ""}</p>
    <p><strong>Size:</strong> ${escapeHtml(r.size || "")}</p>
    <p><strong>Colour:</strong> ${escapeHtml(r.colour || "")}</p>

    <h2>Notes</h2>
    ${noteList}
  `;
}

function renderEditForm(r, statuses) {
  const opts = statuses.map(s => {
    const sel = Number(s.status_id) === Number(r.status_id) ? "selected" : "";
    return `<option value="${s.status_id}" ${sel}>${escapeHtml(s.status_name)}</option>`;
  }).join("");

  return `
    <h1>Edit Request #${r.request_id}</h1>

    <form action="/requests/${r.request_id}/update" method="post" aria-label="Edit request form">
      <div class="field">
        <label for="item_name">Item name</label>
        <input id="item_name" name="item_name" required minlength="2" value="${escapeAttr(r.item_name || "")}" />
      </div>

      <div class="field">
        <label for="brand">Brand</label>
        <input id="brand" name="brand" value="${escapeAttr(r.brand || "")}" />
      </div>

      <div class="field">
        <label for="budget_gbp">Budget (GBP)</label>
        <input id="budget_gbp" name="budget_gbp" type="number" min="0" step="1" value="${r.budget_gbp ?? ""}" />
      </div>

      <div class="field">
        <label for="size">Size</label>
        <input id="size" name="size" value="${escapeAttr(r.size || "")}" />
      </div>

      <div class="field">
        <label for="colour">Colour</label>
        <input id="colour" name="colour" value="${escapeAttr(r.colour || "")}" />
      </div>

      <div class="field">
        <label for="status_id">Status</label>
        <select id="status_id" name="status_id">${opts}</select>
      </div>

      <div class="field">
        <label for="notes">Add note (optional)</label>
        <textarea id="notes" name="notes" placeholder="Add an update for this request..."></textarea>
      </div>

      <div class="row">
        <button class="btn primary" type="submit">Save changes</button>
        <a class="btn" href="/requests/${r.request_id}">Cancel</a>
      </div>
    </form>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}