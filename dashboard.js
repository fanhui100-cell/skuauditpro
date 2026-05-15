let plans = [];
let paymentMethods = [];

const statusText = {
  paid: "已开通",
  pending_payment: "待付款",
  reviewing: "审核中",
};

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

function money(plan) {
  if (!plan.priceCny) {
    return "免费";
  }
  return `¥${plan.priceCny} / HK$${plan.priceHkd}${plan.interval === "month" ? " / 月" : ""}`;
}

async function loadDashboard() {
  const { user } = await api("/api/me");
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  document.querySelector("#welcome").textContent = `${user.name}，欢迎回来`;
  document.querySelector("#account-email").textContent = user.email;

  const config = await api("/api/plans");
  plans = config.plans;
  paymentMethods = config.paymentMethods;

  const current = plans.find((plan) => plan.id === user.planId) || plans[0];
  document.querySelector("#current-plan").textContent = current.name;

  renderPlans();
  renderPayments();
  renderCheckoutOptions();
  await loadOrders();
}

function renderPlans() {
  const list = document.querySelector("#plan-list");
  list.innerHTML = "";

  plans.forEach((plan) => {
    const card = document.createElement("article");
    card.className = `price-card${plan.popular ? " featured" : ""}`;
    card.innerHTML = `
      <p class="plan-name">${plan.interval === "month" ? "订阅" : "一次性"}</p>
      <h3>${plan.name}</h3>
      <strong>${money(plan)}</strong>
      <ul>${plan.features.map((feature) => `<li>${feature}</li>`).join("")}</ul>
      <button class="button primary full" data-plan="${plan.id}" type="button">选择这个套餐</button>
    `;
    list.append(card);
  });

  document.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("#checkout-plan").value = button.dataset.plan;
      document.querySelector("#checkout").scrollIntoView({ behavior: "smooth" });
    });
  });
}

function renderPayments() {
  const list = document.querySelector("#payment-list");
  list.innerHTML = paymentMethods
    .map(
      (method) => `
        <article class="payment-item">
          <strong>${method.name}</strong>
          <span>${method.currency} · ${method.status}</span>
          <p>${method.note}</p>
        </article>
      `,
    )
    .join("");
}

function renderCheckoutOptions() {
  document.querySelector("#checkout-plan").innerHTML = plans
    .map((plan) => `<option value="${plan.id}">${plan.name} - ${money(plan)}</option>`)
    .join("");

  document.querySelector("#checkout-method").innerHTML = paymentMethods
    .map((method) => `<option value="${method.id}">${method.name}</option>`)
    .join("");
}

async function loadOrders() {
  const { orders } = await api("/api/orders");
  const body = document.querySelector("#order-list");

  if (!orders.length) {
    body.innerHTML = '<tr><td colspan="6">暂无订单。选择一个套餐后会出现在这里。</td></tr>';
    return;
  }

  body.innerHTML = "";
  orders.forEach((order) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${order.planName}</td>
      <td>¥${order.amountCny} / HK$${order.amountHkd}</td>
      <td>${order.paymentMethod}</td>
      <td><span class="risk-chip ${order.status === "paid" ? "good" : "watch"}">${statusText[order.status] || order.status}</span></td>
      <td>${order.proofNote || "-"}</td>
      <td>
        ${
          order.status === "pending_payment"
            ? `<button class="button secondary" data-proof="${order.id}" type="button">提交付款备注</button>`
            : "-"
        }
      </td>
    `;
    body.append(tr);
  });

  document.querySelectorAll("[data-proof]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proofNote = window.prompt("请输入付款备注，例如：付款人姓名、转账时间、尾号。");
      if (!proofNote) {
        return;
      }
      await api(`/api/orders/${button.dataset.proof}/proof`, {
        method: "POST",
        body: JSON.stringify({ proofNote }),
      });
      await loadOrders();
    });
  });
}

document.querySelector("#checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#checkout-message");
  message.textContent = "正在创建订单...";

  try {
    const { checkoutUrl } = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        planId: document.querySelector("#checkout-plan").value,
        paymentMethod: document.querySelector("#checkout-method").value,
      }),
    });

    if (checkoutUrl) {
      window.location.href = checkoutUrl;
      return;
    }

    message.textContent = "订单已创建。请按付款方式转账后，在订单里提交付款备注。";
    await loadOrders();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector("#logout").addEventListener("click", async () => {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
});

loadDashboard();
