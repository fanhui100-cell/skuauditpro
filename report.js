const form = document.querySelector("#report-form");
const input = document.querySelector("#report-id");
const result = document.querySelector("#report-result");

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const statusText = {
  new: "已收到需求，等待补充 SKU 成本数据",
  reviewing: "正在体检中",
  ready: "报告已完成，等待交付确认",
  delivered: "报告已交付",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function percent(value) {
  return `${Math.round((Number(value) || 0) * 1000) / 10}%`;
}

function riskClass(item) {
  const margin = Number(item.result?.margin) || 0;
  if (margin < 0) return "bad";
  if (margin < 0.12) return "watch";
  return "good";
}

function reportConclusion(report) {
  const summary = report.summary || {};
  if (!summary.count) {
    return "当前报告已创建，但还没有关联到已保存的 SKU 测算。请先登录后保存 SKU 计算，或联系顾问补充批量数据。";
  }

  if (summary.lossCount > 0) {
    return `已发现 ${summary.lossCount} 个亏损 SKU，建议优先暂停放量、复核物流/佣金/广告成本，再决定是否调价或下架。`;
  }

  if (summary.watchCount > 0) {
    return `整体没有明显亏损 SKU，但有 ${summary.watchCount} 个商品净利率偏薄，建议先优化成本后再扩大投放。`;
  }

  return "当前已保存 SKU 的利润表现较健康，可继续观察退货率、达人佣金和广告 CPA 的变化。";
}

function renderMetric(label, value, hint = "") {
  return `
    <div>
      <span>${label}</span>
      <strong>${value}</strong>
      ${hint ? `<small>${hint}</small>` : ""}
    </div>
  `;
}

function renderSkuRows(calculations = []) {
  if (!calculations.length) {
    return `
      <tr>
        <td colspan="7">暂无关联 SKU 测算。客户登录后在首页保存计算，或由顾问补充批量体检数据。</td>
      </tr>
    `;
  }

  return calculations
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.sku || "未命名 SKU")}</td>
          <td>${escapeHtml(item.platform || "-")}</td>
          <td>${money.format(Number(item.result?.netProfit) || 0)}</td>
          <td>${percent(item.result?.margin)}</td>
          <td>${money.format(Number(item.result?.breakEven) || 0)}</td>
          <td><span class="risk-chip ${riskClass(item)}">${escapeHtml(item.risk || "-")}</span></td>
          <td>${escapeHtml((item.recommendations || []).slice(0, 2).join("；") || "-")}</td>
        </tr>
      `,
    )
    .join("");
}

function renderPriorityBlock(report) {
  const priority = report.summary?.prioritySku;
  if (!priority) {
    return `
      <article class="report-advice-card">
        <h3>下一步</h3>
        <p>补充 3-20 个 SKU 的基础成本数据后，报告会自动展示亏损风险、保本售价和优先处理清单。</p>
      </article>
    `;
  }

  return `
    <article class="report-advice-card">
      <h3>优先处理 SKU</h3>
      <p><strong>${escapeHtml(priority.sku || "未命名 SKU")}</strong> 当前净利率为 ${percent(priority.result?.margin)}，建议优先复核成本和投放策略。</p>
    </article>
  `;
}

function renderReport(report) {
  const status = report.status || "new";
  const summary = report.summary || {};
  const calculations = report.calculations || [];

  result.innerHTML = `
    <div class="report-document-header">
      <div>
        <p class="eyebrow">Report No.</p>
        <h2>${escapeHtml(report.reportId)}</h2>
      </div>
      <div class="report-actions-print">
        <span class="risk-chip ${status === "delivered" ? "good" : "watch"}">${statusText[status] || status}</span>
        <button class="button secondary" type="button" id="print-report-page">打印 / 保存 PDF</button>
      </div>
    </div>

    <dl class="report-detail-list">
      <div><dt>客户</dt><dd>${escapeHtml(report.name || "-")}</dd></div>
      <div><dt>平台</dt><dd>${escapeHtml(report.platform || "-")}</dd></div>
      <div><dt>目标 SKU 数</dt><dd>${escapeHtml(report.skuCount || "-")}</dd></div>
      <div><dt>提交时间</dt><dd>${new Date(report.createdAt).toLocaleString()}</dd></div>
    </dl>

    <section class="report-section">
      <h3>核心结论</h3>
      <p class="report-conclusion">${escapeHtml(reportConclusion(report))}</p>
      <div class="report-metric-strip">
        ${renderMetric("已分析 SKU", summary.count || 0, "来自已保存测算")}
        ${renderMetric("亏损 SKU", summary.lossCount || 0, "净利率 < 0")}
        ${renderMetric("观察 SKU", summary.watchCount || 0, "0-12% 净利率")}
        ${renderMetric("平均净利率", percent(summary.avgMargin), "样本均值")}
        ${renderMetric("单件净利润合计", money.format(Number(summary.totalNetProfit) || 0), "按样本相加")}
      </div>
    </section>

    <section class="report-section">
      <h3>客户补充说明</h3>
      <p>${escapeHtml(report.pain || "暂无补充说明。")}</p>
    </section>

    <section class="report-section">
      <div class="report-section-title">
        <h3>SKU 风险排序</h3>
        <span>${calculations.length ? "按风险和保存时间展示" : "等待补充数据"}</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>平台</th>
              <th>净利润</th>
              <th>净利率</th>
              <th>保本售价</th>
              <th>风险</th>
              <th>建议</th>
            </tr>
          </thead>
          <tbody>${renderSkuRows(calculations)}</tbody>
        </table>
      </div>
    </section>

    <section class="report-section report-advice-grid">
      ${renderPriorityBlock(report)}
      <article class="report-advice-card">
        <h3>经营动作</h3>
        <p>先处理亏损和低毛利 SKU，再扩大达人合作或广告预算。建议每次调整后重新保存一次测算，形成版本记录。</p>
      </article>
      <article class="report-advice-card">
        <h3>合规提示</h3>
        <p>利润、关税和合规提示仅用于商业预判，不替代报关行、税务顾问或律师意见。</p>
      </article>
    </section>

    <div class="report-footer-note">
      <strong>SKUAuditPro</strong>
      <span>本报告基于客户主动提供或保存的数据生成。请在正式采购、投放或申报前复核关键成本。</span>
    </div>
  `;

  document.querySelector("#print-report-page").addEventListener("click", () => window.print());
}

async function lookupReport(event) {
  event.preventDefault();
  const reportId = input.value.trim();
  if (!reportId) {
    return;
  }

  result.innerHTML = '<p class="form-note">正在生成报告...</p>';

  try {
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "报告不存在。");
    }
    renderReport(data.report);
  } catch (error) {
    result.innerHTML = `<p class="form-note">${escapeHtml(error.message)}</p>`;
  }
}

const idFromUrl = new URLSearchParams(window.location.search).get("id");
form.addEventListener("submit", lookupReport);

if (idFromUrl) {
  input.value = idFromUrl;
  form.requestSubmit();
}
