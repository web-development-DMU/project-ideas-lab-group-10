const API = "/api/requests";

/* =========================
   CREATE REQUEST
========================= */
document.getElementById("form")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const item = document.getElementById("item").value;

  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer_name: "Emmanuel",
      item_name: item,
      request_password: "123"
    })
  });

  alert("Request created");
});

/* =========================
   LOAD REQUESTS
========================= */
async function loadRequests(){
  const res = await fetch(API);
  const data = await res.json();

  const list = document.getElementById("list");

  if(!list) return;

  list.innerHTML = data.data.map(r =>
    `<p>${r.item_name} - ${r.status_name}</p>`
  ).join("");
}

/* =========================
   ADMIN VIEW
========================= */
async function loadAdmin(){
  const res = await fetch(API);
  const data = await res.json();

  const list = document.getElementById("adminList");

  if(!list) return;

  list.innerHTML = data.data.map(r =>
    `
    <div>
      <strong>${r.item_name}</strong>
      <button onclick="updateStatus(${r.id}, 'Completed')">Complete</button>
    </div>
    `
  ).join("");
}

/* =========================
   UPDATE STATUS
========================= */
async function updateStatus(id, status){
  await fetch(`/api/requests/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status_name: status })
  });

  alert("Updated");
  loadAdmin();
}

/* INIT */
loadRequests();