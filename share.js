const result = document.querySelector("#share-result");
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

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

function renderCalculation(item) {
  result.innerHTML = `
    <div class="report-status-top">
      <span class="risk-chip ${item.result?.margin < 0 ? "bad" : item.result?.margin < 0.12 ? "watch" : "good"}">${escapeHtml(item.risk || "-")}</span>
      <strong>${escapeHtml(item.sku || "未命名 SKU")}</strong>
    </div>
    <dl class="report-detail-list">
      <div><dt>平台</dt><dd>${escapeHtml(item.platform || "-")}</dd></div>
      <div><dt>净利润</dt><dd>${money.format(Number(item.result?.netProfit) || 0)}</dd></div>
      <div><dt>净利率</dt><dd>${percent(item.result?.margin)}</dd></div>
      <div><dt>保本售价</dt><dd>${money.format(Number(item.result?.breakEven) || 0)}</dd></div>
    </dl>
    <div class="advice-box">
      <h3>建议</h3>
      <ul>${(item.recommendations || []).map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
    </div>
    <p class="form-note">这是只读分享页，不包含客户账号、联系方式或订单信息。</p>
  `;
}

async function loadShare() {
  const token = new URLSearchParams(window.location.search).get("id");
  if (!token) {
    result.innerHTML = '<p class="form-note">缺少分享编号。</p>';
    return;
  }

  try {
    const response = await fetch(`/api/calculations/public/${encodeURIComponent(token)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "分享内容不存在。");
    }
    renderCalculation(data.calculation);
  } catch (error) {
    result.innerHTML = `<p class="form-note">${escapeHtml(error.message)}</p>`;
  }
}

loadShare();
