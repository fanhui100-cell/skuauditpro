let adminCode = "";

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function loadAdmin() {
  const data = await api(`/api/admin/orders?code=${encodeURIComponent(adminCode)}`);
  renderOrders(data.orders);
  renderLeads(data.leads);
}

function renderOrders(orders) {
  const body = document.querySelector("#admin-orders");
  if (!orders.length) {
    body.innerHTML = '<tr><td colspan="7">暂无订单。</td></tr>';
    return;
  }

  body.innerHTML = "";
  orders.forEach((order) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.user?.email || "-"}</td>
      <td>${order.planName}</td>
      <td>¥${order.amountCny} / HK$${order.amountHkd}</td>
      <td>${order.paymentMethod}</td>
      <td>${order.status}</td>
      <td>${order.proofNote || "-"}</td>
      <td>${
        order.status !== "paid"
          ? `<button class="button secondary" data-paid="${order.id}" type="button">标记已付款</button>`
          : "已完成"
      }</td>
    `;
    body.append(tr);
  });

  document.querySelectorAll("[data-paid]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api("/api/admin/mark-paid", {
        method: "POST",
        body: JSON.stringify({ code: adminCode, orderId: button.dataset.paid }),
      });
      await loadAdmin();
    });
  });
}

function renderLeads(leads) {
  const body = document.querySelector("#admin-leads");
  if (!leads.length) {
    body.innerHTML = '<tr><td colspan="5">暂无线索。</td></tr>';
    return;
  }

  body.innerHTML = leads
    .map(
      (lead) => `
        <tr>
          <td>${lead.name || "-"}</td>
          <td>${lead.contact || "-"}</td>
          <td>${lead.platform || "-"}</td>
          <td>${lead.skuCount || "-"}</td>
          <td>${lead.pain || "-"}</td>
        </tr>
      `,
    )
    .join("");
}

document.querySelector("#admin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  adminCode = document.querySelector("#admin-code").value;
  await loadAdmin();
});
