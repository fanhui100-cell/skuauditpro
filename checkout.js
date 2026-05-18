const pendingUpgradeKey = "skuauditpro-upgrade-plan";
const params = new URLSearchParams(window.location.search);

let plans = [];
let paymentMethods = [];
let selectedPlanId = params.get("plan") || localStorage.getItem(pendingUpgradeKey) || "audit-20-sku";
let currentUser = null;

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(plan) {
  if (!plan.priceCny) {
    return "免费";
  }
  return `¥${plan.priceCny} / HK$${plan.priceHkd}${plan.interval === "month" ? " / 月" : ""}`;
}

function selectedPlan() {
  return plans.find((plan) => plan.id === selectedPlanId) || plans.find((plan) => plan.id === "audit-20-sku") || plans[0];
}

function paidPlans() {
  return plans.filter((plan) => plan.priceCny > 0);
}

function qrMethods() {
  return paymentMethods.filter((method) => method.qrImage);
}

function renderPlan() {
  const plan = selectedPlan();
  if (!plan) {
    return;
  }

  selectedPlanId = plan.id;
  localStorage.setItem(pendingUpgradeKey, selectedPlanId);
  document.querySelector("#checkout-plan-name").textContent = plan.name;
  document.querySelector("#checkout-plan-price").textContent = money(plan);
  document.querySelector("#checkout-plan-features").innerHTML = plan.features
    .map((feature) => `<li>${escapeHtml(feature)}</li>`)
    .join("");

  document.querySelector("#checkout-plan-tabs").innerHTML = paidPlans()
    .map(
      (item) => `
        <button class="checkout-plan-tab${item.id === selectedPlanId ? " active" : ""}" data-checkout-plan="${item.id}" type="button">
          <span>${escapeHtml(item.name)}</span>
          <strong>${money(item)}</strong>
        </button>
      `,
    )
    .join("");

  document.querySelectorAll("[data-checkout-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedPlanId = button.dataset.checkoutPlan;
      const url = new URL(window.location.href);
      url.searchParams.set("plan", selectedPlanId);
      window.history.replaceState(null, "", url);
      renderPlan();
    });
  });
}

function renderPayments() {
  document.querySelector("#checkout-qr-list").innerHTML = qrMethods()
    .map(
      (method) => `
        <article>
          <img src="${escapeHtml(method.qrImage)}" alt="${escapeHtml(method.name)}" loading="lazy" />
          <strong>${escapeHtml(method.name)}</strong>
          <p>${escapeHtml(method.note)}</p>
        </article>
      `,
    )
    .join("");

  document.querySelector("#checkout-method").innerHTML = paymentMethods
    .map((method) => `<option value="${escapeHtml(method.id)}">${escapeHtml(method.name)}</option>`)
    .join("");
}

function renderAuthState() {
  const note = document.querySelector("#checkout-auth-note");
  const button = document.querySelector("#checkout-create-order");
  if (currentUser) {
    note.textContent = `当前账号：${currentUser.email}`;
    button.textContent = "创建订单";
    button.classList.remove("secondary");
    button.classList.add("primary");
    return;
  }

  const next = `/checkout.html?plan=${encodeURIComponent(selectedPlanId)}`;
  note.innerHTML = `未登录也可以先扫码付款；建议先 <a href="login.html?next=${encodeURIComponent(next)}">登录或注册</a>，创建订单后方便提交付款备注。`;
  button.textContent = "登录后创建订单";
  button.classList.remove("primary");
  button.classList.add("secondary");
}

async function loadCheckout() {
  const [{ plans: loadedPlans, paymentMethods: loadedMethods }, { user }] = await Promise.all([
    api("/api/plans"),
    api("/api/me"),
  ]);

  plans = loadedPlans;
  paymentMethods = loadedMethods;
  currentUser = user;

  if (!plans.some((plan) => plan.id === selectedPlanId && plan.priceCny > 0)) {
    selectedPlanId = "audit-20-sku";
  }

  renderPlan();
  renderPayments();
  renderAuthState();
}

document.querySelector("#checkout-order-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    localStorage.setItem(pendingUpgradeKey, selectedPlanId);
    window.location.href = `login.html?next=${encodeURIComponent(`/checkout.html?plan=${selectedPlanId}`)}`;
    return;
  }

  const message = document.querySelector("#checkout-message");
  message.textContent = "正在创建订单...";

  try {
    const { checkoutUrl, order } = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        planId: selectedPlanId,
        paymentMethod: document.querySelector("#checkout-method").value,
      }),
    });

    if (checkoutUrl) {
      window.location.href = checkoutUrl;
      return;
    }

    message.innerHTML = `订单已创建：${escapeHtml(order.id)}。付款后请到账户中心“我的订单”提交付款备注。 <a href="dashboard.html#orders">查看订单</a>`;
    localStorage.removeItem(pendingUpgradeKey);
  } catch (error) {
    message.textContent = error.message;
  }
});

loadCheckout().catch((error) => {
  document.querySelector("#checkout-message").textContent = error.message;
});
