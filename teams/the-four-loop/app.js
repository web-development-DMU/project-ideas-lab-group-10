const $ = (id) => document.getElementById(id);

function setMsg(text, type = "muted") {
  const el = $("msg");
  el.className = type;
  el.textContent = text;
}

function fmtMoney(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `£${n.toFixed(2)}`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

async function loadRequests() {
  const res = await fetch("/api/requests");
  const data = await res.json();

  const rows = $("rows");
  rows.innerHTML = "";

  for (const r of data.requests) {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="muted">#${r.request_id}</td>
      <td><strong>${escapeHtml(r.item_name)}</strong>
        <div class="muted">${escapeHtml(r.size ?? "")} ${escapeHtml(r.colour ?? "")}</div>
      </td>
      <td>${escapeHtml(r.brand ?? "—")}</td>
      <td>${fmtMoney(r.budget_gbp)}</td>
      <td><span class="pill">${escapeHtml(r.status_name)}</span></td>
      <td class="muted">${escapeHtml(r.created_at)}</td>
      <td>
        <div class="actions">
          <select data-id="${r.request_id}">
            <option>New</option>
            <option>In Progress</option>
            <option>Sourced</option>
            <option>Completed</option>
          </select>
          <button data-action="status" data-id="${r.request_id}">Update</button>
          <button data-action="delete" data-id="${r.request_id}">Delete</button>
        </div>
      </td>
    `;

    rows.appendChild(tr);

    const sel = tr.querySelector("select");
    sel.value = r.status_name;
  }
}

async function createRequest() {
  const payload = {
    item_name: $("item_name").value.trim(),
    brand: $("brand").value.trim() || null,
    budget_gbp: $("budget_gbp").value ? Number($("budget_gbp").value) : null,
    size: $("size").value.trim() || null,
    colour: $("colour").value.trim() || null,
  };

  if (payload.item_name.length < 2) {
    setMsg("Item name is required (min 2 characters).", "error");
    return;
  }

  const res = await fetch("/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    setMsg(data.error ?? "Failed to create request", "error");
    return;
  }

  setMsg(`Created request #${data.request_id}`, "success");

  $("item_name").value = "";
  $("brand").value = "";
  $("budget_gbp").value = "";
  $("size").value = "";
  $("colour").value = "";

  await loadRequests();
}

async function updateStatus(requestId) {
  const sel = document.querySelector(`select[data-id="${requestId}"]`);
  const status_name = sel.value;

  const res = await fetch("/api/requests/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: Number(requestId), status_name }),
  });

  if (!res.ok) {
    setMsg("Failed to update status", "error");
    return;
  }

  setMsg(`Updated #${requestId} → ${status_name}`, "success");
  await loadRequests();
}

async function deleteReq(requestId) {
  const ok = confirm(`Delete request #${requestId}?`);
  if (!ok) return;

  const res = await fetch("/api/requests/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request_id: Number(requestId) }),
  });

  if (!res.ok) {
    setMsg("Failed to delete request", "error");
    return;
  }

  setMsg(`Deleted request #${requestId}`, "success");
  await loadRequests();
}

$("createBtn").addEventListener("click", createRequest);
$("refreshBtn").addEventListener("click", loadRequests);

document.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");

  if (action === "status") updateStatus(id);
  if (action === "delete") deleteReq(id);
});

loadRequests();