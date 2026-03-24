
const ADMIN_PASSWORD = "sourceflowadmin";

const ADMIN_SESSION_KEY = "sourceflow_admin_logged_in";

const REQUEST_SESSION_PREFIX = "sourceflow_request_access_";




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




function statusClass(status) {

  const s = String(status || "").toLowerCase();

  if (s === "new") return "status-new";

  if (s === "in progress") return "status-in-progress";

  if (s === "sourced") return "status-sourced";

  if (s === "completed") return "status-completed";

  return "";

}




async function fetchJson(url, options = {}) {

  const response = await fetch(url, options);

  const text = await response.text();




  let payload = {};

  try {

    payload = text ? JSON.parse(text) : {};

  } catch {

    throw new Error("Invalid server response.");

  }




  if (!response.ok || payload.ok === false) {

    throw new Error(payload.error || `Request failed (${response.status})`);

  }




  return payload;

}




function requestLink(id) {

  return `/app/request.html?id=${id}`;

}




function markRequestAccessGranted(id) {

  sessionStorage.setItem(`${REQUEST_SESSION_PREFIX}${id}`, "true");

}




function hasRequestAccess(id) {

  return sessionStorage.getItem(`${REQUEST_SESSION_PREFIX}${id}`) === "true";

}




async function promptForRequestPasswordAndOpen(id) {

  const password = window.prompt("Enter the request password to open this record:");

  if (!password) return;




  try {

    await fetchJson("/api/requests/verify", {

      method: "POST",

      headers: { "content-type": "application/json" },

      body: JSON.stringify({

        request_id: id,

        request_password: password,

      }),

    });




    markRequestAccessGranted(id);

    window.location.href = requestLink(id);

  } catch (error) {

    window.alert(error.message);

  }

}




async function loadDashboard() {

  const totalEl = document.getElementById("statTotal");

  if (!totalEl) return;




  const result = await fetchJson("/api/dashboard");

  const data = result.data;




  document.getElementById("statTotal").textContent = data.total;

  document.getElementById("statNew").textContent = data.newCount;

  document.getElementById("statProgress").textContent = data.inProgress;

  document.getElementById("statCompleted").textContent = data.completed;




  const recentList = document.getElementById("recentRequestsList");

  recentList.innerHTML = "";




  if (!data.recent.length) {

    recentList.innerHTML = `<p class="empty">No requests yet.</p>`;

    return;

  }




  recentList.innerHTML = data.recent.map((row) => `

    <div class="list-item">

      <div class="list-item-top">

        <div>

          <strong>${escapeHtml(row.item_name)}</strong><br />

          <span class="small">${escapeHtml(row.customer_name)}</span>

        </div>

        <span class="status-pill ${statusClass(row.status_name)}">${escapeHtml(row.status_name)}</span>

      </div>

      <div class="actions">

        <button type="button" data-open-request="${row.request_id}">Open detail</button>

      </div>

    </div>

  `).join("");




  recentList.querySelectorAll("[data-open-request]").forEach((button) => {

    button.addEventListener("click", () => {

      const id = Number(button.getAttribute("data-open-request"));

      promptForRequestPasswordAndOpen(id);

    });

  });

}




function setupQuickRequestForm() {

  const form = document.getElementById("quickRequestForm");

  if (!form) return;




  const statusEl = document.getElementById("quickRequestStatus");




  form.addEventListener("submit", async (event) => {

    event.preventDefault();

    statusEl.textContent = "Submitting...";




    try {

      await fetchJson("/api/requests", {

        method: "POST",

        headers: { "content-type": "application/json" },

        body: JSON.stringify({

          customer_name: "Guest Customer",

          customer_email: "",

          item_name: document.getElementById("quick_item_name").value.trim(),

          brand: document.getElementById("quick_brand").value.trim(),

          budget_gbp: document.getElementById("quick_budget").value.trim(),

          size: document.getElementById("quick_size").value.trim(),

          colour: "",

          request_password: "guest123",

        }),

      });




      form.reset();

      statusEl.textContent = "Request submitted.";

      await loadDashboard();

    } catch (error) {

      statusEl.textContent = error.message;

    }

  });

}




async function loadRequestsTable() {

  const tbody = document.getElementById("requestsTableBody");

  if (!tbody) return;




  const result = await fetchJson("/api/requests");

  const rows = result.data;




  if (!rows.length) {

    tbody.innerHTML = `

      <tr>

        <td colspan="5" class="empty">No requests have been submitted yet.</td>

      </tr>

    `;

    return;

  }




  tbody.innerHTML = rows.map((row) => `

    <tr>

      <td><span class="status-pill ${statusClass(row.status_name)}">${escapeHtml(row.status_name)}</span></td>

      <td>${escapeHtml(row.item_name)}</td>

      <td>${row.budget_gbp ?? ""}</td>

      <td>${formatDate(row.updated_at)}</td>

      <td><button type="button" data-open-request="${row.request_id}">View</button></td>

    </tr>

  `).join("");




  tbody.querySelectorAll("[data-open-request]").forEach((button) => {

    button.addEventListener("click", () => {

      const id = Number(button.getAttribute("data-open-request"));

      promptForRequestPasswordAndOpen(id);

    });

  });

}




function setupRequestForm() {

  const form = document.getElementById("requestForm");

  if (!form) return;




  const statusEl = document.getElementById("requestStatus");

  const refreshBtn = document.getElementById("refreshRequestsBtn");




  form.addEventListener("submit", async (event) => {

    event.preventDefault();

    statusEl.textContent = "Submitting request...";




    try {

      await fetchJson("/api/requests", {

        method: "POST",

        headers: { "content-type": "application/json" },

        body: JSON.stringify({

          customer_name: document.getElementById("customer_name").value.trim(),

          customer_email: document.getElementById("customer_email").value.trim(),

          item_name: document.getElementById("item_name").value.trim(),

          brand: document.getElementById("brand").value.trim(),

          budget_gbp: document.getElementById("budget_gbp").value.trim(),

          size: document.getElementById("size").value.trim(),

          colour: document.getElementById("colour").value.trim(),

          request_password: document.getElementById("request_password").value.trim(),

        }),

      });




      form.reset();

      statusEl.textContent = "Request submitted successfully.";

      await loadRequestsTable();

    } catch (error) {

      statusEl.textContent = error.message;

    }

  });




  refreshBtn?.addEventListener("click", loadRequestsTable);

}




function showAdminPanel() {

  document.getElementById("adminLoginCard").hidden = true;

  document.getElementById("adminPanel").hidden = false;

}




function showAdminLogin() {

  document.getElementById("adminLoginCard").hidden = false;

  document.getElementById("adminPanel").hidden = true;

}




async function loadAdminTable() {

  const tbody = document.getElementById("adminTableBody");

  if (!tbody) return;




  const result = await fetchJson("/api/requests");

  const rows = result.data;




  if (!rows.length) {

    tbody.innerHTML = `

      <tr>

        <td colspan="6" class="empty">No requests currently in the queue.</td>

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

      <td>${escapeHtml(row.item_name)}</td>

      <td><span class="status-pill ${statusClass(row.status_name)}">${escapeHtml(row.status_name)}</span></td>

      <td>

        <select data-request-id="${row.request_id}">

          ${["New", "In Progress", "Sourced", "Completed"].map((status) => `

            <option value="${status}" ${status === row.status_name ? "selected" : ""}>${status}</option>

          `).join("")}

        </select>

        <div class="actions">

          <button type="button" data-save-status="${row.request_id}">Save</button>

        </div>

      </td>

      <td><button type="button" data-open-request="${row.request_id}">Open</button></td>

    </tr>

  `).join("");




  tbody.querySelectorAll("[data-save-status]").forEach((button) => {

    button.addEventListener("click", async () => {

      const requestId = button.getAttribute("data-save-status");

      const select = tbody.querySelector(`select[data-request-id="${requestId}"]`);




      await fetchJson(`/api/requests/${requestId}/status`, {

        method: "PATCH",

        headers: { "content-type": "application/json" },

        body: JSON.stringify({ status_name: select.value }),

      });




      await loadAdminTable();

    });

  });




  tbody.querySelectorAll("[data-open-request]").forEach((button) => {

    button.addEventListener("click", async () => {

      const id = Number(button.getAttribute("data-open-request"));

      promptForRequestPasswordAndOpen(id);

    });

  });

}




function setupAdminPage() {

  if (!document.getElementById("adminPage")) return;




  const loginForm = document.getElementById("adminLoginForm");

  const loginStatus = document.getElementById("adminLoginStatus");

  const refreshBtn = document.getElementById("refreshAdminBtn");

  const logoutBtn = document.getElementById("logoutAdminBtn");




  const loggedIn = localStorage.getItem(ADMIN_SESSION_KEY) === "true";

  if (loggedIn) {

    showAdminPanel();

    loadAdminTable();

  } else {

    showAdminLogin();

  }




  loginForm?.addEventListener("submit", async (event) => {

    event.preventDefault();




    const password = document.getElementById("adminPasswordInput").value;

    if (password !== ADMIN_PASSWORD) {

      loginStatus.textContent = "Incorrect password.";

      return;

    }




    localStorage.setItem(ADMIN_SESSION_KEY, "true");

    loginStatus.textContent = "";

    showAdminPanel();

    await loadAdminTable();

  });




  refreshBtn?.addEventListener("click", loadAdminTable);




  logoutBtn?.addEventListener("click", () => {

    localStorage.removeItem(ADMIN_SESSION_KEY);

    showAdminLogin();

  });

}




function getRequestIdFromQuery() {

  const params = new URLSearchParams(window.location.search);

  return Number(params.get("id"));

}




async function ensureRequestPasswordAccess(requestId) {

  if (hasRequestAccess(requestId)) return true;




  const password = window.prompt("Enter the request password to access this request:");

  if (!password) return false;




  try {

    await fetchJson("/api/requests/verify", {

      method: "POST",

      headers: { "content-type": "application/json" },

      body: JSON.stringify({

        request_id: requestId,

        request_password: password,

      }),

    });




    markRequestAccessGranted(requestId);

    return true;

  } catch (error) {

    window.alert(error.message);

    return false;

  }

}




async function loadRequestDetail() {

  const title = document.getElementById("detailTitle");

  if (!title) return;




  const id = getRequestIdFromQuery();

  if (!id) {

    title.textContent = "Request not found";

    return;

  }




  const allowed = await ensureRequestPasswordAccess(id);

  if (!allowed) {

    window.location.href = "/app/requests.html";

    return;

  }




  const result = await fetchJson(`/api/requests/${id}`);

  const { request, notes } = result.data;




  title.textContent = `Request #${request.request_id}`;




  const statusBadge = document.getElementById("detailStatusBadge");

  statusBadge.textContent = request.status_name;

  statusBadge.className = `status-pill ${statusClass(request.status_name)}`;




  document.getElementById("detailMeta").innerHTML = `

    <div class="detail-row"><strong>Item</strong><span>${escapeHtml(request.item_name)}</span></div>

    <div class="detail-row"><strong>Brand</strong><span>${escapeHtml(request.brand ?? "")}</span></div>

    <div class="detail-row"><strong>Size</strong><span>${escapeHtml(request.size ?? "")}</span></div>

    <div class="detail-row"><strong>Budget</strong><span>£${request.budget_gbp ?? ""}</span></div>

    <div class="detail-row"><strong>Created</strong><span>${formatDate(request.created_at)}</span></div>

    <div class="detail-row"><strong>Updated</strong><span>${formatDate(request.updated_at)}</span></div>

  `;




  document.getElementById("customerBlock").innerHTML = `

    <div class="detail-row"><strong>Name</strong><span>${escapeHtml(request.customer_name)}</span></div>

    <div class="detail-row"><strong>Email</strong><span>${escapeHtml(request.customer_email ?? "")}</span></div>

  `;




  const timeline = [

    { name: "New", active: true },

    { name: "In Progress", active: ["In Progress", "Sourced", "Completed"].includes(request.status_name) },

    { name: "Sourced", active: ["Sourced", "Completed"].includes(request.status_name) },

    { name: "Completed", active: request.status_name === "Completed" },

  ];




  document.getElementById("timelineList").innerHTML = timeline.map((item) => `

    <div class="timeline-item">

      <div class="timeline-dot" style="background:${item.active ? "#7ad88d" : "rgba(255,255,255,0.3)"}"></div>

      <div><strong>${item.name}</strong></div>

    </div>

  `).join("");




  document.getElementById("detailStatusSelect").value = request.status_name;




  const notesList = document.getElementById("notesList");

  if (!notes.length) {

    notesList.innerHTML = `<p class="empty">No notes yet.</p>`;

  } else {

    notesList.innerHTML = notes.map((note) => `

      <div class="note-card">

        <div><strong>${formatDate(note.created_at)}</strong></div>

        <div>${escapeHtml(note.note_text)}</div>

      </div>

    `).join("");

  }

}




function setupDetailPage() {

  const saveBtn = document.getElementById("saveDetailStatusBtn");

  if (!saveBtn) return;




  const noteForm = document.getElementById("noteForm");

  const noteStatus = document.getElementById("noteStatus");

  const detailStatusMessage = document.getElementById("detailStatusMessage");

  const requestId = getRequestIdFromQuery();




  saveBtn.addEventListener("click", async () => {

    const statusName = document.getElementById("detailStatusSelect").value;

    detailStatusMessage.textContent = "Saving...";




    try {

      await fetchJson(`/api/requests/${requestId}/status`, {

        method: "PATCH",

        headers: { "content-type": "application/json" },

        body: JSON.stringify({ status_name: statusName }),

      });




      detailStatusMessage.textContent = "Status updated.";

      await loadRequestDetail();

    } catch (error) {

      detailStatusMessage.textContent = error.message;

    }

  });




  noteForm?.addEventListener("submit", async (event) => {

    event.preventDefault();

    const noteText = document.getElementById("noteText").value.trim();

    noteStatus.textContent = "Saving...";




    try {

      await fetchJson(`/api/requests/${requestId}/notes`, {

        method: "POST",

        headers: { "content-type": "application/json" },

        body: JSON.stringify({ note_text: noteText }),

      });




      document.getElementById("noteText").value = "";

      noteStatus.textContent = "Note added.";

      await loadRequestDetail();

    } catch (error) {

      noteStatus.textContent = error.message;

    }

  });

}




async function init() {

  if (document.getElementById("statTotal")) {

    await loadDashboard();

    setupQuickRequestForm();

  }




  if (document.getElementById("requestForm")) {

    setupRequestForm();

    await loadRequestsTable();

  }




  if (document.getElementById("adminPage")) {

    setupAdminPage();

  }




  if (document.getElementById("detailTitle")) {

    await loadRequestDetail();

    setupDetailPage();

  }

}




init();