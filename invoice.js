const root = document.querySelector("#invoice-document");

const statusText = {
  pending: "待支付",
  paid: "已支付",
  overdue: "逾期",
  cancelled: "已取消",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatCurrency(amount, currency = "HKD") {
  return `${currency} ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusClass(status) {
  if (status === "paid") return "good";
  if (status === "overdue" || status === "cancelled") return "bad";
  return "watch";
}

function renderInvoice(invoice, company) {
  root.innerHTML = `
    <div class="invoice-toolbar">
      <button class="button secondary" id="print-invoice" type="button">打印 / 保存 PDF</button>
    </div>
    <div class="invoice-top">
      <div class="invoice-company">
        ${
          company.logoDataUrl
            ? `<img class="invoice-logo" src="${company.logoDataUrl}" alt="${escapeHtml(company.companyName)} logo" />`
            : `<span class="brand-mark">SA</span>`
        }
        <div>
          <strong>${escapeHtml(company.companyName || "SKUAuditPro")}</strong>
          <p>${escapeHtml(company.legalName || "")}</p>
          <p>${escapeHtml(company.email || "")}</p>
          <p>${escapeHtml(company.address || "")}</p>
        </div>
      </div>
      <div class="invoice-title">
        <p class="eyebrow">Invoice</p>
        <h1>${escapeHtml(invoice.invoiceNo)}</h1>
        <span class="risk-chip ${statusClass(invoice.status)}">${statusText[invoice.status] || invoice.status}</span>
      </div>
    </div>

    <dl class="invoice-meta">
      <div><dt>客户</dt><dd>${escapeHtml(invoice.customerName || "-")}</dd></div>
      <div><dt>客户邮箱</dt><dd>${escapeHtml(invoice.customerEmail || "-")}</dd></div>
      <div><dt>开通套餐</dt><dd>${escapeHtml(invoice.planName || "-")}</dd></div>
      <div><dt>开票日期</dt><dd>${new Date(invoice.issuedAt).toLocaleDateString()}</dd></div>
      <div><dt>到期日期</dt><dd>${new Date(invoice.dueAt).toLocaleDateString()}</dd></div>
    </dl>

    <div class="table-wrap invoice-table-wrap">
      <table class="invoice-table">
        <thead>
          <tr>
            <th>服务项目</th>
            <th>来源报价</th>
            <th>备注</th>
            <th>金额</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(invoice.serviceName)}</td>
            <td>${escapeHtml(invoice.quoteNo || "-")}</td>
            <td>${escapeHtml(invoice.notes || "-")}</td>
            <td>${formatCurrency(invoice.amount, invoice.currency)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="invoice-total">
      <span>Total Due</span>
      <strong>${formatCurrency(invoice.amount, invoice.currency)}</strong>
    </div>

    <section class="invoice-payment">
      <h2>付款说明</h2>
      <p>${escapeHtml(company.paymentInstructions || "Please include the invoice number in your payment note.")}</p>
    </section>

    <footer class="invoice-footer">
      <span>本发票由 SKUAuditPro 生成。利润、关税和合规提示仅用于商业预判。</span>
      <span>${escapeHtml(invoice.invoiceNo)}</span>
    </footer>
  `;

  document.querySelector("#print-invoice").addEventListener("click", () => window.print());
}

async function loadInvoice() {
  const token = new URLSearchParams(window.location.search).get("id");
  if (!token) {
    root.innerHTML = '<p class="form-note">缺少发票链接编号。</p>';
    return;
  }

  try {
    const response = await fetch(`/api/invoices/public/${encodeURIComponent(token)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "发票不存在。");
    }
    renderInvoice(data.invoice, data.company);
  } catch (error) {
    root.innerHTML = `<p class="form-note">${escapeHtml(error.message)}</p>`;
  }
}

loadInvoice();
