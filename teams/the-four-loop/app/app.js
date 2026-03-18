const ADMIN_PASSWORD = "sourceflowadmin";
const ADMIN_SESSION_KEY = "sourceflow_admin_logged_in";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  let payload = null;
  const text = await response.text();

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Server returned invalid JSON: ${text}`);
  }

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload;
}

async function loadRequestsTable() {
  const tbody = document.getElementById("requestsTableBody");
  if (!tbody) return;

  try {
    const result = await fetchJson("/api/requests");
    const rows = result.data || [];

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty">No requests have been submitted yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${row.request_id}</td>
        <td>${escapeHtml(row.customer_name)}</td>
        <td>${escapeHtml(row.item_name)}</td>
        <td>${escapeHtml(row.brand ?? "")}</td>
        <td>${row.budget_gbp ?? ""}</td>
        <td>${escapeHtml(row.status_name)}</td>
        <td>${formatDate(row.created_at)}</td>
      </tr>
    `).join("");
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">Failed to load requests: ${escapeHtml(error.message)}</td>
      </tr>
    `;
  }
}

async function setupCustomerPage() {
  const form = document.getElementById("requestForm");
  const refreshButton = document.getElementById("refreshRequestsBtn");
  const statusEl = document.getElementById("requestStatus");

  if (!form || !refreshButton || !statusEl) return;

  refreshButton.addEventListener("click", async () => {
    statusEl.className = "status";
    statusEl.textContent = "Refreshing...";
    await loadRequestsTable();
    statusEl.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    statusEl.className = "status";
    statusEl.textContent = "Creating request...";

    const payload = {
      customer_name: document.getElementById("customer_name").value.trim(),
      customer_email: document.getElementById("customer_email").value.trim(),
      item_name: document.getElementById("item_name").value.trim(),
      brand: document.getElementById("brand").value.trim(),
      budget_gbp: document.getElementById("budget_gbp").value.trim(),
      size: document.getElementById("size").value.trim(),
      colour: document.getElementById("colour").value.trim(),
    };

    try {
      await fetchJson("/api/requests", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      form.reset();
      statusEl.className = "status success";
      statusEl.textContent = "Request created successfully.";
      await loadRequestsTable();
    } catch (error) {
      statusEl.className = "status error";
      statusEl.textContent = error.message;
    }
  });

  await loadRequestsTable();
}

async function loadAdminTable() {
  const tbody = document.getElementById("adminTableBody");
  if (!tbody) return;

  try {
    const result = await fetchJson("/api/requests");
    const rows = result.data || [];

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="empty">No requests are currently in the queue.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td>${row.request_id}</td>
        <td>
          <strong>${escapeHtml(row.customer_name)}</strong><br />
          <span class="small">${escapeHtml(row.customer_email ?? "")}</span>
        </td>
        <td>
          <strong>${escapeHtml(row.item_name)}</strong><br />
          <span class="small">${escapeHtml(row.brand ?? "")}</span>
        </td>
        <td>${escapeHtml(row.status_name)}</td>
        <td>
          <select data-request-id="${row.request_id}">
            ${["New", "In Progress", "Sourced", "Completed"].map((status) => `
              <option value="${status}" ${status === row.status_name ? "selected" : ""}>
                ${status}
              </option>
            `).join("")}
          </select>
          <div class="actions">
            <button type="button" data-save-status="${row.request_id}">Save</button>
          </div>
        </td>
        <td>
          <div class="small">Internal notes can be added in the next iteration.</div>
        </td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-save-status]").forEach((button) => {
      button.addEventListener("click", async () => {
        const requestId = button.getAttribute("data-save-status");
        const select = tbody.querySelector(`select[data-request-id="${requestId}"]`);
        const statusName = select.value;

        try {
          await fetchJson(`/api/requests/${requestId}/status`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ status_name: statusName }),
          });

          await loadAdminTable();
        } catch (error) {
          alert(`Failed to update status: ${error.message}`);
        }
      });
    });
  } catch (error) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="empty">Failed to load admin data: ${escapeHtml(error.message)}</td>
      </tr>
    `;
  }
}

function showAdminPanel() {
  const loginCard = document.getElementById("adminLoginCard");
  const panel = document.getElementById("adminPanel");

  if (loginCard) loginCard.hidden = true;
  if (panel) panel.hidden = false;
}

function showAdminLogin() {
  const loginCard = document.getElementById("adminLoginCard");
  const panel = document.getElementById("adminPanel");

  if (loginCard) loginCard.hidden = false;
  if (panel) panel.hidden = true;
}

async function setupAdminPage() {
  const loginForm = document.getElementById("adminLoginForm");
  const loginStatus = document.getElementById("adminLoginStatus");
  const refreshButton = document.getElementById("refreshAdminBtn");
  const logoutButton = document.getElementById("logoutAdminBtn");

  const loggedIn = localStorage.getItem(ADMIN_SESSION_KEY) === "true";

  if (loggedIn) {
    showAdminPanel();
    await loadAdminTable();
  } else {
    showAdminLogin();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const password = document.getElementById("adminPasswordInput").value;

      if (password !== ADMIN_PASSWORD) {
        loginStatus.className = "status error";
        loginStatus.textContent = "Incorrect password.";
        return;
      }

      localStorage.setItem(ADMIN_SESSION_KEY, "true");
      loginStatus.className = "status success";
      loginStatus.textContent = "Access granted.";

      showAdminPanel();
      await loadAdminTable();
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", loadAdminTable);
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", () => {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      showAdminLogin();
    });
  }
}

async function init() {
  if (document.getElementById("requestForm")) {
    await setupCustomerPage();
  }

  if (document.getElementById("adminPage")) {
    await setupAdminPage();
  }
}

init();