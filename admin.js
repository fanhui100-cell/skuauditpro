let adminCode = "";
let companyLogoDataUrl = "";

const adminPlanOptions = [
  { id: "free-3-sku", name: "免费测 3 个 SKU" },
  { id: "audit-20-sku", name: "入门月度包" },
  { id: "store-audit", name: "增长月度包" },
  { id: "pro-monthly", name: "服务商月度包" },
];

const invoiceStatusText = {
  pending: "待支付",
  paid: "已支付",
  overdue: "逾期",
  cancelled: "已取消",
};

const quoteStatusText = {
  draft: "草稿",
  sent: "已发送",
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

async function loadAdmin() {
  const data = await api(`/api/admin/orders?code=${encodeURIComponent(adminCode)}`);
  renderOrders(data.orders);
  renderLeads(data.leads);
  await loadBilling();
}

function formatCurrency(amount, currency = "HKD") {
  return `${currency} ${Number(amount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

async function loadBilling() {
  const data = await api(`/api/admin/billing?code=${encodeURIComponent(adminCode)}`);
  renderBillingOverview(data.overview, data.quotes, data.invoices);
  renderCompanySettings(data.company);
  renderUsers(data.users || []);
  renderQuotes(data.quotes);
  renderInvoices(data.invoices);
}

function renderCompanySettings(company) {
  document.querySelector("#company-name").value = company.companyName || "";
  document.querySelector("#company-legal-name").value = company.legalName || "";
  document.querySelector("#company-email").value = company.email || "";
  document.querySelector("#company-address").value = company.address || "";
  document.querySelector("#company-payment").value = company.paymentInstructions || "";
  companyLogoDataUrl = company.logoDataUrl || "";
  document.querySelector("#company-logo-preview").innerHTML = companyLogoDataUrl
    ? `<img src="${companyLogoDataUrl}" alt="Company logo" />`
    : '<span class="table-muted">尚未上传 Logo</span>';
}

function renderBillingOverview(overview, quotes, invoices) {
  const converted = quotes.filter((quote) => quote.invoiceId).length;
  const conversion = quotes.length ? Math.round((converted / quotes.length) * 100) : 0;
  document.querySelector("#admin-total-revenue").textContent = formatCurrency(overview.total);
  document.querySelector("#admin-paid-revenue").textContent = formatCurrency(overview.paid);
  document.querySelector("#admin-pending-revenue").textContent = formatCurrency(overview.pending);
  document.querySelector("#admin-overdue-revenue").textContent = formatCurrency(overview.overdue);
  document.querySelector("#admin-conversion-rate").textContent = `${conversion}%`;
}

function renderUsers(users) {
  const body = document.querySelector("#admin-users");
  if (!body) {
    return;
  }

  if (!users.length) {
    body.innerHTML = '<tr><td colspan="7">暂无注册用户。</td></tr>';
    return;
  }

  body.innerHTML = users
    .map((user) => {
      const usage = user.usage || { used: 0, limit: user.quota || 0, remaining: user.quota || 0 };
      const recentReports = Array.isArray(user.recentReports) ? user.recentReports : [];
      const recentHtml = recentReports.length
        ? recentReports
            .map(
              (report) =>
                `<a href="report.html?id=${encodeURIComponent(report.reportId)}" target="_blank">${escapeHtml(report.sku || report.reportId)}</a>`,
            )
            .join("<br />")
        : '<span class="table-muted">暂无报告</span>';
      return `
        <tr>
          <td>${escapeHtml(user.name || "-")}<br /><span class="table-muted">${escapeHtml(user.email)}</span></td>
          <td>${escapeHtml(adminPlanOptions.find((plan) => plan.id === user.planId)?.name || user.planId || "-")}</td>
          <td>${escapeHtml(user.provider || "email")}</td>
          <td>${usage.used}/${usage.limit}<br /><span class="table-muted">剩余 ${usage.remaining}</span></td>
          <td>${recentHtml}</td>
          <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</td>
          <td>
            <select data-user-plan="${user.id}">
              ${adminPlanOptions
                .map((plan) => `<option value="${plan.id}" ${plan.id === user.planId ? "selected" : ""}>${plan.name}</option>`)
                .join("")}
            </select>
          </td>
        </tr>
      `;
    })
    .join("");

  document.querySelectorAll("[data-user-plan]").forEach((select) => {
    select.addEventListener("change", async () => {
      await api(`/api/admin/users/${select.dataset.userPlan}/plan`, {
        method: "POST",
        body: JSON.stringify({ code: adminCode, planId: select.value }),
      });
      await loadBilling();
    });
  });
}

function renderQuotes(quotes) {
  const body = document.querySelector("#admin-quotes");
  if (!quotes.length) {
    body.innerHTML = '<tr><td colspan="7">暂无报价。</td></tr>';
    return;
  }

  body.innerHTML = quotes
    .map(
      (quote) => `
        <tr>
          <td>${escapeHtml(quote.quoteNo)}</td>
          <td>${escapeHtml(quote.customerName || "-")}<br /><span class="table-muted">${escapeHtml(quote.customerEmail)}</span></td>
          <td>${escapeHtml(quote.serviceName)}</td>
          <td>${escapeHtml(quote.planName || "-")}</td>
          <td>${formatCurrency(quote.amount, quote.currency)}</td>
          <td><span class="risk-chip ${quote.invoiceId ? "good" : "watch"}">${quoteStatusText[quote.status] || quote.status}</span></td>
          <td>${
            quote.invoiceId
              ? "已生成"
              : `<button class="button secondary compact-button" data-convert-quote="${quote.id}" type="button">转 Invoice</button>`
          }</td>
        </tr>
      `,
    )
    .join("");

  document.querySelectorAll("[data-convert-quote]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/admin/quotes/${button.dataset.convertQuote}/convert`, {
        method: "POST",
        body: JSON.stringify({ code: adminCode, dueDays: 7 }),
      });
      await loadBilling();
    });
  });
}

function renderInvoices(invoices) {
  const body = document.querySelector("#admin-invoices");
  if (!invoices.length) {
    body.innerHTML = '<tr><td colspan="7">暂无发票。</td></tr>';
    return;
  }

  body.innerHTML = invoices
    .map(
      (invoice) => `
        <tr>
          <td>${escapeHtml(invoice.invoiceNo)}<br /><span class="table-muted">${escapeHtml(invoice.quoteNo || "-")}</span></td>
          <td>${escapeHtml(invoice.customerName || "-")}<br /><span class="table-muted">${escapeHtml(invoice.customerEmail)}</span></td>
          <td>${escapeHtml(invoice.planName || "-")}${invoice.upgradedAt ? '<br /><span class="table-muted">已自动开通</span>' : ""}</td>
          <td>${formatCurrency(invoice.amount, invoice.currency)}</td>
          <td>${new Date(invoice.dueAt).toLocaleDateString()}</td>
          <td><span class="risk-chip ${invoice.status === "paid" ? "good" : invoice.status === "overdue" ? "bad" : "watch"}">${invoiceStatusText[invoice.status] || invoice.status}</span></td>
          <td>
            <select data-invoice-status="${invoice.id}">
              <option value="pending" ${invoice.status === "pending" ? "selected" : ""}>待支付</option>
              <option value="paid" ${invoice.status === "paid" ? "selected" : ""}>已支付</option>
              <option value="overdue" ${invoice.status === "overdue" ? "selected" : ""}>逾期</option>
              <option value="cancelled" ${invoice.status === "cancelled" ? "selected" : ""}>已取消</option>
            </select>
            <button class="button secondary compact-button" data-invoice-link="${invoice.publicToken}" type="button">复制链接</button>
          </td>
        </tr>
      `,
    )
    .join("");

  document.querySelectorAll("[data-invoice-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      await api(`/api/admin/invoices/${select.dataset.invoiceStatus}/status`, {
        method: "POST",
        body: JSON.stringify({ code: adminCode, status: select.value }),
      });
      await loadBilling();
    });
  });

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
      <td>${escapeHtml(order.user?.email || "-")}</td>
      <td>${escapeHtml(order.planName)}</td>
      <td>¥${escapeHtml(order.amountCny)} / HK$${escapeHtml(order.amountHkd)}</td>
      <td>${escapeHtml(order.paymentMethod)}</td>
      <td>${escapeHtml(order.status)}</td>
      <td>${escapeHtml(order.proofNote || "-")}</td>
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
    body.innerHTML = '<tr><td colspan="9">暂无线索。</td></tr>';
    return;
  }

  body.innerHTML = leads
    .map(
      (lead) => `
        <tr>
          <td>${escapeHtml(lead.name || "-")}</td>
          <td>${lead.reportId ? `<a href="report.html?id=${encodeURIComponent(lead.reportId)}" target="_blank">${escapeHtml(lead.reportId)}</a>` : "-"}</td>
          <td>${escapeHtml(lead.contact || "-")}</td>
          <td>${escapeHtml(lead.platform || "-")}</td>
          <td>${escapeHtml(lead.skuCount || "-")}</td>
          <td>${escapeHtml(lead.pain || "-")}</td>
          <td>${escapeHtml(lead.source || "-")}</td>
          <td>${escapeHtml(lead.status || "new")}</td>
          <td>
            <select data-lead-status="${lead.id}">
              <option value="new" ${(lead.status || "new") === "new" ? "selected" : ""}>新需求</option>
              <option value="reviewing" ${lead.status === "reviewing" ? "selected" : ""}>体检中</option>
              <option value="ready" ${lead.status === "ready" ? "selected" : ""}>已完成</option>
              <option value="delivered" ${lead.status === "delivered" ? "selected" : ""}>已交付</option>
            </select>
          </td>
        </tr>
      `,
    )
    .join("");

  document.querySelectorAll("[data-lead-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      await api("/api/admin/leads/status", {
        method: "POST",
        body: JSON.stringify({
          code: adminCode,
          leadId: select.dataset.leadStatus,
          status: select.value,
        }),
      });
      await loadAdmin();
    });
  });
}

document.querySelector("#admin-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  adminCode = document.querySelector("#admin-code").value;
  await loadAdmin();
});

document.querySelector("#quote-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#quote-message");
  message.textContent = "正在创建报价...";

  try {
    await api("/api/admin/quotes", {
      method: "POST",
      body: JSON.stringify({
        code: adminCode,
        customerEmail: document.querySelector("#quote-email").value,
        customerName: document.querySelector("#quote-name").value,
        serviceName: document.querySelector("#quote-service").value,
        planId: document.querySelector("#quote-plan").value,
        amount: document.querySelector("#quote-amount").value,
        currency: document.querySelector("#quote-currency").value,
        validDays: document.querySelector("#quote-valid-days").value,
        notes: document.querySelector("#quote-notes").value,
      }),
    });
    event.target.reset();
    document.querySelector("#quote-service").value = "入门月度包";
    document.querySelector("#quote-plan").value = "audit-20-sku";
    document.querySelector("#quote-amount").value = "32";
    document.querySelector("#quote-valid-days").value = "7";
    message.textContent = "报价已创建。客户登录同邮箱账号后可接受报价。";
    await loadBilling();
  } catch (error) {
    message.textContent = error.message;
  }
});

document.querySelector("#company-logo").addEventListener("change", () => {
  const file = document.querySelector("#company-logo").files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    companyLogoDataUrl = String(reader.result || "");
    document.querySelector("#company-logo-preview").innerHTML = `<img src="${companyLogoDataUrl}" alt="Company logo" />`;
  });
  reader.readAsDataURL(file);
});

document.querySelector("#company-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = document.querySelector("#company-message");
  message.textContent = "正在保存...";

  try {
    await api("/api/admin/settings/company", {
      method: "POST",
      body: JSON.stringify({
        code: adminCode,
        companyName: document.querySelector("#company-name").value,
        legalName: document.querySelector("#company-legal-name").value,
        email: document.querySelector("#company-email").value,
        address: document.querySelector("#company-address").value,
        paymentInstructions: document.querySelector("#company-payment").value,
        logoDataUrl: companyLogoDataUrl,
      }),
    });
    message.textContent = "公司资料已保存。公开发票页会使用这些信息。";
    await loadBilling();
  } catch (error) {
    message.textContent = error.message;
  }
});
