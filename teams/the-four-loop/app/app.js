const path = location.pathname;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

async function getRequests() {
  const res = await fetch("/api/requests");
  return await res.json();
}

async function createRequest(payload) {
  const res = await fetch("/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return { ok: res.ok, data: await res.json() };
}

async function updateStatus(id, status_name) {
  const res = await fetch(`/api/requests/${id}/status`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status_name })
  });
  return { ok: res.ok, data: await res.json() };
}

if (path.endsWith("/app/requests.html")) {
  const rowsEl = document.getElementById("rows");
  const form = document.getElementById("createForm");
  const msgEl = document.getElementById("msg");
  const refreshBtn = document.getElementById("refreshBtn");

  async function render() {
    const rows = await getRequests();
    rowsEl.innerHTML = rows.map(r => `
      <tr>
        <td>${r.request_id}</td>
        <td>${escapeHtml(r.customer_name)}</td>
        <td>${escapeHtml(r.item_name)}</td>
        <td>${escapeHtml(r.brand ?? "")}</td>
        <td>${r.budget_gbp ?? ""}</td>
        <td>${escapeHtml(r.status_name)}</td>
        <td>${new Date(r.created_at).toLocaleString()}</td>
      </tr>
    `).join("");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgEl.textContent = "Creating...";

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    const out = await createRequest(payload);
    if (!out.ok) {
      msgEl.textContent = out.data.error || "Failed";
      return;
    }

    form.reset();
    msgEl.textContent = "✅ Created";
    await render();
  });

  refreshBtn.addEventListener("click", render);
  render();
}

if (path.endsWith("/app/admin.html")) {
  const rowsEl = document.getElementById("rows");
  const refreshBtn = document.getElementById("refreshBtn");
  const statuses = ["New", "In Progress", "Sourced", "Completed"];

  async function render() {
    const rows = await getRequests();
    rowsEl.innerHTML = rows.map(r => `
      <tr>
        <td>${r.request_id}</td>
        <td>${escapeHtml(r.customer_name)}</td>
        <td>${escapeHtml(r.item_name)}</td>
        <td>${escapeHtml(r.status_name)}</td>
        <td>
          <select data-id="${r.request_id}">
            ${statuses.map(s => `<option ${s === r.status_name ? "selected" : ""}>${s}</option>`).join("")}
          </select>
          <button data-save="${r.request_id}" type="button">Save</button>
        </td>
      </tr>
    `).join("");

    rowsEl.querySelectorAll("button[data-save]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-save");
        const sel = rowsEl.querySelector(`select[data-id="${id}"]`);
        await updateStatus(id, sel.value);
        await render();
      });
    });
  }

  refreshBtn.addEventListener("click", render);
  render();
}