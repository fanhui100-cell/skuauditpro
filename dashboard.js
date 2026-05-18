let plans = [];
let paymentMethods = [];
let calculations = [];
let currentUser = null;
let quotes = [];
let invoices = [];

const statusText = {
  paid: "已开通",
  pending_payment: "待付款",
  reviewing: "审核中",
};

const invoiceStatusText = {
  pending: "待支付",
  paid: "已支付",
  overdue: "逾期",
  cancelled: "已取消",
};

const quoteStatusText = {
  sent: "待接受",
  accepted: "已接受",
  converted: "已转发票",
  expired: "已过期",
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

function usd(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function percent(value) {
  return `${Math.round((Number(value) || 0) * 1000) / 10}%`;
}

function formatCurrency(amount, currency = "HKD") {
  return `${currency} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

async function loadDashboard() {
  const { user } = await api("/api/me");
  if (!user) {
    window.location.href = "/login.html";
    return;
  }
  currentUser = user;

  document.querySelector("#welcome").textContent = `${user.name}，欢迎回来`;
  document.querySelector("#account-email").textContent = user.email;
  document.querySelector("#onboarding").hidden = user.onboarded;

  const config = await api("/api/plans");
  plans = config.plans;
  paymentMethods = config.paymentMethods;

  const current = plans.find((plan) => plan.id === user.planId) || plans[0];
  document.querySelector("#current-plan").textContent = current.name;

  renderPlans();
  renderPayments();
  renderCheckoutOptions();
  await loadCalculations();
  await loadBilling();
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
          <div>
            <strong>${method.name}</strong>
            <span>${method.currency} · ${method.status}</span>
            <p>${method.note}</p>
          </div>
          ${
            method.qrImage
              ? `<img class="payment-qr" src="${method.qrImage}" alt="${method.name} QR code" loading="lazy" />`
              : ""
          }
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

async function loadCalculations() {
  const data = await api("/api/calculations");
  calculations = data.calculations;
  const body = document.querySelector("#calculation-history");

  if (!calculations.length) {
    body.innerHTML = '<tr><td colspan="9">暂无计算历史。去首页计算一个 SKU 后点击“保存到我的记录”。</td></tr>';
    return;
  }

  body.innerHTML = calculations
    .map((item) => {
      const recommendations = Array.isArray(item.recommendations)
        ? item.recommendations.slice(0, 2).join("；")
        : "-";
      return `
        <tr>
          <td>${new Date(item.createdAt).toLocaleString()}</td>
          <td>${escapeHtml(item.sku || "-")}</td>
          <td>${escapeHtml(item.platform || "-")}</td>
          <td>${usd(item.result?.netProfit)}</td>
          <td>${percent(item.result?.margin)}</td>
          <td>${usd(item.result?.breakEven)}</td>
          <td><span class="risk-chip ${item.result?.margin < 0 ? "bad" : item.result?.margin < 0.12 ? "watch" : "good"}">${escapeHtml(item.risk || "-")}</span></td>
          <td>${escapeHtml(recommendations)}</td>
          <td>
            <div class="table-actions">
              <button class="button secondary compact-button" data-edit="${item.id}" type="button">重新编辑</button>
              <button class="button secondary compact-button" data-share="${item.shareToken}" type="button">复制分享链接</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      const item = calculations.find((calculation) => calculation.id === button.dataset.edit);
      if (!item) {
        return;
      }
      localStorage.setItem("skuauditpro-edit-inputs", JSON.stringify(item.inputs || {}));
      window.location.href = "/#calculator";
    });
  });

  document.querySelectorAll("[data-share]").forEach((button) => {
    button.addEventListener("click", async () => {
      const url = `${window.location.origin}/share.html?id=${encodeURIComponent(button.dataset.share)}`;
      await copyValue(url);
      button.textContent = "已复制";
      setTimeout(() => {
        button.textContent = "复制分享链接";
      }, 1400);
    });
  });
}

async function loadBilling() {
  const data = await api("/api/billing");
  quotes = data.quotes;
  invoices = data.invoices;
  renderBillingOverview(data.overview);
  renderQuotes();
  renderInvoices();
}

function renderBillingOverview(overview) {
  document.querySelector("#billing-total").textContent = formatCurrency(overview.total);
  document.querySelector("#billing-paid").textContent = formatCurrency(overview.paid);
  document.querySelector("#billing-pending").textContent = formatCurrency(overview.pending);
  document.querySelector("#billing-overdue").textContent = formatCurrency(overview.overdue);
  document.querySelector("#billing-quotes-count").textContent = quotes.length;
}

function renderQuotes() {
  const body = document.querySelector("#quote-list");
  if (!quotes.length) {
    body.innerHTML = '<tr><td colspan="7">暂无报价。顾问创建报价后会显示在这里。</td></tr>';
    return;
  }

  body.innerHTML = quotes
    .map(
      (quote) => `
        <tr>
          <td>${escapeHtml(quote.quoteNo)}</td>
          <td>${escapeHtml(quote.serviceName)}</td>
          <td>${escapeHtml(quote.planName || "-")}</td>
          <td>${formatCurrency(quote.amount, quote.currency)}</td>
          <td>${new Date(quote.expiresAt).toLocaleDateString()}</td>
          <td><span class="risk-chip ${quote.invoiceId ? "good" : "watch"}">${quoteStatusText[quote.status] || quote.status}</span></td>
          <td>${
            quote.invoiceId
              ? "已生成 Invoice"
              : `<button class="button secondary compact-button" data-accept-quote="${quote.id}" type="button">接受并生成 Invoice</button>`
          }</td>
        </tr>
      `,
    )
    .join("");

  document.querySelectorAll("[data-accept-quote]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/quotes/${button.dataset.acceptQuote}/accept`, { method: "POST" });
      await loadBilling();
    });
  });
}

function renderInvoices() {
  const body = document.querySelector("#invoice-list");
  if (!invoices.length) {
    body.innerHTML = '<tr><td colspan="7">暂无发票。接受报价后会自动生成。</td></tr>';
    return;
  }

  body.innerHTML = invoices
    .map(
      (invoice) => `
        <tr>
          <td>${escapeHtml(invoice.invoiceNo)}<br /><span class="table-muted">${escapeHtml(invoice.quoteNo || "-")}</span></td>
          <td>${escapeHtml(invoice.serviceName)}</td>
          <td>${escapeHtml(invoice.planName || "-")}${invoice.upgradedAt ? '<br /><span class="table-muted">已开通</span>' : ""}</td>
          <td>${formatCurrency(invoice.amount, invoice.currency)}</td>
          <td>${new Date(invoice.dueAt).toLocaleDateString()}</td>
          <td><span class="risk-chip ${invoice.status === "paid" ? "good" : invoice.status === "overdue" ? "bad" : "watch"}">${invoiceStatusText[invoice.status] || invoice.status}</span></td>
          <td><button class="button secondary compact-button" data-invoice-link="${invoice.publicToken}" type="button">复制链接</button></td>
        </tr>
      `,
    )
    .join("");

  document.querySelectorAll("[data-invoice-link]").forEach((button) => {
    button.addEventListener("click", async () => {
      await copyValue(`${window.location.origin}/invoice.html?id=${encodeURIComponent(button.dataset.invoiceLink)}`);
      button.textContent = "已复制";
      setTimeout(() => {
        button.textContent = "复制链接";
      }, 1400);
    });
  });
}

function downloadCsv(csv, filename) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportHistory() {
  if (!calculations.length) {
    return;
  }

  const header = ["createdAt", "sku", "platform", "netProfit", "margin", "breakEven", "risk", "recommendations"];
  const rows = calculations.map((item) =>
    [
      item.createdAt,
      item.sku,
      item.platform,
      item.result?.netProfit,
      percent(item.result?.margin),
      item.result?.breakEven,
      item.risk,
      Array.isArray(item.recommendations) ? item.recommendations.join(" | ") : "",
    ]
      .map(escapeCsv)
      .join(","),
  );
  downloadCsv([header.join(","), ...rows].join("\n"), "skuauditpro-calculation-history.csv");
}

async function copyValue(value) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
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

document.querySelector("#export-history").addEventListener("click", exportHistory);

document.querySelector("#finish-onboarding").addEventListener("click", async () => {
  await api("/api/account/onboarding", { method: "POST", body: JSON.stringify({ done: true }) });
  document.querySelector("#onboarding").hidden = true;
});

document.querySelector("#password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const note = document.querySelector("#password-note");
  note.textContent = "正在更新...";

  try {
    await api("/api/account/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: document.querySelector("#current-password").value,
        newPassword: document.querySelector("#new-password").value,
      }),
    });
    event.target.reset();
    note.textContent = "密码已更新。";
  } catch (error) {
    note.textContent = error.message;
  }
});

document.querySelector("#delete-account-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const note = document.querySelector("#delete-note");
  if (!window.confirm("确定要注销账户并删除订单、计算历史吗？")) {
    return;
  }

  try {
    await api("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ confirm: document.querySelector("#delete-confirm").value }),
    });
    window.location.href = "/";
  } catch (error) {
    note.textContent = error.message;
  }
});

loadDashboard();
