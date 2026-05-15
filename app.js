const form = document.querySelector("#profit-form");
const leadForm = document.querySelector("#lead-form");
const exportButton = document.querySelector("#export-leads");
const clearButton = document.querySelector("#clear-leads");
const bulkCsv = document.querySelector("#bulk-csv");
const runBulkButton = document.querySelector("#run-bulk");
const loadDemoButton = document.querySelector("#load-demo");
const clearBulkButton = document.querySelector("#clear-bulk");
const exportBulkButton = document.querySelector("#export-bulk");
const printReportButton = document.querySelector("#print-report");
const copySingleButton = document.querySelector("#copy-single-report");
const isEnglish = document.documentElement.lang.startsWith("en");

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const text = isEnglish
  ? {
      healthy: "Healthy",
      warning: "Thin",
      loss: "Loss",
      healthySummary: "This SKU still has room to scale.",
      warningSummary: "This SKU is profitable, but the margin is too thin for aggressive scaling.",
      lossSummary: "This SKU loses money on every sale. Reprice or pause before scaling.",
      adviceLoss: "This SKU is below break-even. Pause scaling and review logistics, commission and ad cost first.",
      adviceWarning: "Margin is thin. Mark this SKU as a watch item before increasing spend.",
      adviceHealthy: "Margin looks healthy. You can continue testing creator deals or ad scaling.",
      adviceCommission: "Affiliate commission is high. To keep about 12% target margin, keep commission below",
      adviceAds: "Ad cost is close to or higher than unit profit. Set a stricter CPA ceiling.",
      adviceShipping: "Logistics and import cost take too much of the selling price. Test bundling, overseas stock or a higher price point.",
      adviceBulk: "Next step: run a 20-SKU bulk audit to find hidden losses and repricing opportunities.",
      noBulk: "No data yet. Load sample data or paste CSV.",
      unnamedSku: "Unnamed SKU",
      copied: "Copied",
      singleReportTitle: "SKU Profit Audit Report",
      sku: "SKU",
      platform: "Platform",
      netProfit: "Net profit",
      margin: "Margin",
      breakEven: "Break-even price",
      maxAffiliate: "Max affiliate commission",
      risk: "Risk level",
      recommendations: "Recommendations",
      leadCount: (count) => `${count} leads`,
      leadSaved: "Saved. You can now follow up and ask for basic data from 3 SKUs.",
      noLeads: "No leads to export yet",
    }
  : {
      healthy: "健康",
      warning: "偏薄",
      loss: "亏损",
      healthySummary: "这个 SKU 当前仍有投放空间，可以进入下一轮测试。",
      warningSummary: "这个 SKU 有利润，但抗风险能力不够，适合先优化成本。",
      lossSummary: "这个 SKU 当前每卖一件都在亏钱，需要先停下来重算。",
      adviceLoss: "当前 SKU 已低于保本线，建议暂停放量，先复核物流、佣金和广告成本。",
      adviceWarning: "净利率偏薄，建议把这个 SKU 标记为黄色观察，不要盲目加大投放。",
      adviceHealthy: "当前净利率较健康，可以继续测试达人合作或广告放量。",
      adviceCommission: "达人佣金偏高。若要保留约 12% 目标净利，佣金建议不超过",
      adviceAds: "广告成本已经接近或超过单件净利润，建议设置更严格的 CPA 上限。",
      adviceShipping: "物流和进口成本占比过高，建议测试海外仓、组合装或提高客单价。",
      adviceBulk: "下一步可以批量上传 20 个 SKU，优先找出隐藏亏损品和可涨价品。",
      noBulk: "暂无数据，先载入示例或粘贴 CSV。",
      unnamedSku: "未命名 SKU",
      copied: "已复制",
      singleReportTitle: "SKU 利润体检报告",
      sku: "SKU",
      platform: "平台",
      netProfit: "单件净利润",
      margin: "净利率",
      breakEven: "保本售价",
      maxAffiliate: "最大达人佣金",
      risk: "风险等级",
      recommendations: "建议",
      leadCount: (count) => `当前 ${count} 条线索`,
      leadSaved: "已保存。现在可以联系对方要 3 个 SKU 的基础数据。",
      noLeads: "当前没有可导出的线索",
    };

const fields = [
  "platform",
  "sku-name",
  "price",
  "cost",
  "shipping",
  "duty",
  "platform-rate",
  "payment-rate",
  "affiliate-rate",
  "ad-cost",
  "return-rate",
  "other-cost",
];

const getNumber = (id) => {
  const value = Number.parseFloat(document.querySelector(`#${id}`).value);
  return Number.isFinite(value) ? value : 0;
};

const getLeads = () => JSON.parse(localStorage.getItem("skuprofit-leads") || "[]");
const saveLeads = (leads) => localStorage.setItem("skuprofit-leads", JSON.stringify(leads));

const demoCsv = isEnglish
  ? `sku,platform,price,cost,shipping,duty,platformRate,paymentRate,affiliateRate,adCost,returnRate,otherCost
LED desk lamp,TikTok Shop,39.99,9.8,5.2,2.1,6,2.9,15,3.4,6,0.7
Low-price accessory set,TikTok Shop,12.99,3.6,4.2,0.8,6,2.9,18,1.8,11,0.4
Car organizer,TikTok Shop,28.9,8.1,5.8,1.6,6,2.9,12,2.9,12,0.6
Portable fill light,TikTok Shop,24.99,6.2,4.1,1.4,6,2.9,15,2.5,8,0.6
Silicone kitchen brush,Shopify,16.99,4.4,3.7,0.9,2,2.9,0,3.2,7,0.5`
  : `sku,platform,price,cost,shipping,duty,platformRate,paymentRate,affiliateRate,adCost,returnRate,otherCost
LED桌面灯,TikTok Shop,39.99,9.8,5.2,2.1,6,2.9,15,3.4,6,0.7
低价饰品套装,TikTok Shop,12.99,3.6,4.2,0.8,6,2.9,18,1.8,11,0.4
车载收纳盒,TikTok Shop,28.9,8.1,5.8,1.6,6,2.9,12,2.9,12,0.6
便携补光灯,TikTok Shop,24.99,6.2,4.1,1.4,6,2.9,15,2.5,8,0.6
厨房硅胶刷,Shopify,16.99,4.4,3.7,0.9,2,2.9,0,3.2,7,0.5`;

let latestBulkRows = [];

function calculateFromData(data) {
  const price = Number(data.price) || 0;
  const cost = Number(data.cost) || 0;
  const shipping = Number(data.shipping) || 0;
  const duty = Number(data.duty) || 0;
  const platformRate = (Number(data.platformRate) || 0) / 100;
  const paymentRate = (Number(data.paymentRate) || 0) / 100;
  const affiliateRate = (Number(data.affiliateRate) || 0) / 100;
  const adCost = Number(data.adCost) || 0;
  const returnRate = (Number(data.returnRate) || 0) / 100;
  const otherCost = Number(data.otherCost) || 0;

  const variableFees = price * (platformRate + paymentRate + affiliateRate);
  const returnLoss = (cost + shipping + duty + otherCost) * returnRate;
  const totalCost = cost + shipping + duty + variableFees + adCost + returnLoss + otherCost;
  const netProfit = price - totalCost;
  const margin = price > 0 ? netProfit / price : 0;
  const fixedCost = cost + shipping + duty + adCost + returnLoss + otherCost;
  const rateCost = platformRate + paymentRate + affiliateRate;
  const breakEven = rateCost < 1 ? fixedCost / (1 - rateCost) : 0;
  const targetProfitRate = 0.12;
  const maxAffiliateRate = Math.max(
    0,
    1 - targetProfitRate - platformRate - paymentRate - fixedCost / Math.max(price, 0.01),
  );

  return {
    netProfit,
    margin,
    breakEven,
    maxAffiliateRate,
    totalCost,
    returnLoss,
    variableFees,
    price,
    adCost,
    shipping,
    duty,
    affiliateRate,
  };
}

function calculateProfit() {
  return calculateFromData({
    price: getNumber("price"),
    cost: getNumber("cost"),
    shipping: getNumber("shipping"),
    duty: getNumber("duty"),
    platformRate: getNumber("platform-rate"),
    paymentRate: getNumber("payment-rate"),
    affiliateRate: getNumber("affiliate-rate"),
    adCost: getNumber("ad-cost"),
    returnRate: getNumber("return-rate"),
    otherCost: getNumber("other-cost"),
  });
}

function buildAdvice(result) {
  const advice = [];

  if (result.margin < 0) {
    advice.push(text.adviceLoss);
  } else if (result.margin < 0.12) {
    advice.push(text.adviceWarning);
  } else {
    advice.push(text.adviceHealthy);
  }

  if (result.affiliateRate > result.maxAffiliateRate) {
    advice.push(`${text.adviceCommission} ${formatPercent(result.maxAffiliateRate)}.`);
  }

  if (result.adCost > result.netProfit && result.netProfit > 0) {
    advice.push(text.adviceAds);
  }

  if (result.shipping + result.duty > result.price * 0.25) {
    advice.push(text.adviceShipping);
  }

  if (advice.length < 3) {
    advice.push(text.adviceBulk);
  }

  return advice;
}

function formatPercent(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function getRisk(result) {
  if (result.margin < 0) {
    return { label: text.loss, className: "bad", rank: 3 };
  }

  if (result.margin < 0.12) {
    return { label: text.warning, className: "watch", rank: 2 };
  }

  return { label: text.healthy, className: "good", rank: 1 };
}

function renderResult() {
  const result = calculateProfit();
  const badge = document.querySelector("#risk-badge");
  const summary = document.querySelector("#result-summary");
  const adviceList = document.querySelector("#advice-list");

  badge.classList.remove("warning", "danger");

  if (result.margin < 0) {
    badge.textContent = text.loss;
    badge.classList.add("danger");
    summary.textContent = text.lossSummary;
  } else if (result.margin < 0.12) {
    badge.textContent = text.warning;
    badge.classList.add("warning");
    summary.textContent = text.warningSummary;
  } else {
    badge.textContent = text.healthy;
    summary.textContent = text.healthySummary;
  }

  document.querySelector("#net-profit").textContent = money.format(result.netProfit);
  document.querySelector("#margin").textContent = formatPercent(result.margin);
  document.querySelector("#break-even").textContent = money.format(result.breakEven);
  document.querySelector("#max-affiliate").textContent = formatPercent(result.maxAffiliateRate);

  adviceList.innerHTML = "";
  buildAdvice(result).forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    adviceList.append(li);
  });
}

function parseCsv(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((value) => value.trim());
    return headers.reduce((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

function renderBulkReport() {
  const rows = parseCsv(bulkCsv.value).map((row) => {
    const result = calculateFromData(row);
    const risk = getRisk(result);
    return {
      ...row,
      result,
      risk,
    };
  });

  latestBulkRows = rows.sort((a, b) => b.risk.rank - a.risk.rank || a.result.margin - b.result.margin);
  const body = document.querySelector("#bulk-results");
  body.innerHTML = "";

  if (!latestBulkRows.length) {
    body.innerHTML = `<tr><td colspan="6">${text.noBulk}</td></tr>`;
    updateBulkSummary([]);
    return;
  }

  latestBulkRows.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.sku || text.unnamedSku}</td>
      <td>${row.platform || "-"}</td>
      <td>${money.format(row.result.netProfit)}</td>
      <td>${formatPercent(row.result.margin)}</td>
      <td>${money.format(row.result.breakEven)}</td>
      <td><span class="risk-chip ${row.risk.className}">${row.risk.label}</span></td>
    `;
    body.append(tr);
  });

  updateBulkSummary(latestBulkRows);
}

function updateBulkSummary(rows) {
  const count = rows.length;
  const loss = rows.filter((row) => row.result.margin < 0).length;
  const priority = rows.filter((row) => row.result.margin < 0.12).length;
  const avgMargin = count
    ? rows.reduce((sum, row) => sum + row.result.margin, 0) / count
    : 0;

  document.querySelector("#bulk-count").textContent = count;
  document.querySelector("#bulk-loss").textContent = loss;
  document.querySelector("#bulk-margin").textContent = formatPercent(avgMargin);
  document.querySelector("#bulk-priority").textContent = priority;
}

function exportBulkReport() {
  if (!latestBulkRows.length) {
    renderBulkReport();
  }

  if (!latestBulkRows.length) {
    return;
  }

  const header = ["sku", "platform", "netProfit", "margin", "breakEven", "maxAffiliateRate", "risk"];
  const rows = latestBulkRows.map((row) =>
    [
      row.sku,
      row.platform,
      row.result.netProfit.toFixed(2),
      formatPercent(row.result.margin),
      row.result.breakEven.toFixed(2),
      formatPercent(row.result.maxAffiliateRate),
      row.risk.label,
    ]
      .map(escapeCsv)
      .join(","),
  );
  const csv = [header.join(","), ...rows].join("\n");
  downloadCsv(csv, "skuprofit-bulk-report.csv");
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

async function copyText(text, successText) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  if (successText) {
    successText.textContent = text.copied;
    setTimeout(() => {
      successText.textContent = successText.dataset.original || successText.textContent;
    }, 1600);
  }
}

function buildSingleReportText() {
  const sku = document.querySelector("#sku-name").value.trim() || text.unnamedSku;
  const platform = document.querySelector("#platform").value;
  const result = calculateProfit();
  const risk = getRisk(result);

  return `${text.singleReportTitle}
${text.sku}: ${sku}
${text.platform}: ${platform}
${text.netProfit}: ${money.format(result.netProfit)}
${text.margin}: ${formatPercent(result.margin)}
${text.breakEven}: ${money.format(result.breakEven)}
${text.maxAffiliate}: ${formatPercent(result.maxAffiliateRate)}
${text.risk}: ${risk.label}
${text.recommendations}:
${buildAdvice(result).map((item) => `- ${item}`).join("\n")}`;
}

function updateLeadCount() {
  document.querySelector("#lead-count").textContent = text.leadCount(getLeads().length);
}

function handleLeadSubmit(event) {
  event.preventDefault();

  const lead = {
    createdAt: new Date().toISOString(),
    name: document.querySelector("#lead-name").value.trim(),
    contact: document.querySelector("#lead-contact").value.trim(),
    platform: document.querySelector("#lead-platform").value,
    skuCount: document.querySelector("#lead-skus").value,
    pain: document.querySelector("#lead-pain").value.trim(),
  };

  const leads = getLeads();
  leads.push(lead);
  saveLeads(leads);
  updateLeadCount();

  fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  }).catch(() => {
    // Static-file previews still keep leads in localStorage.
  });

  leadForm.reset();
  document.querySelector("#lead-note").textContent = text.leadSaved;
}

function escapeCsv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function exportLeads() {
  const leads = getLeads();

  if (!leads.length) {
    document.querySelector("#lead-count").textContent = text.noLeads;
    return;
  }

  const header = ["createdAt", "name", "contact", "platform", "skuCount", "pain"];
  const rows = leads.map((lead) => header.map((key) => escapeCsv(lead[key])).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  downloadCsv(csv, "skuprofit-leads.csv");
}

function clearLeads() {
  if (!getLeads().length) {
    updateLeadCount();
    return;
  }

  localStorage.removeItem("skuprofit-leads");
  updateLeadCount();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  renderResult();
});

fields.forEach((id) => {
  document.querySelector(`#${id}`).addEventListener("input", renderResult);
});

leadForm.addEventListener("submit", handleLeadSubmit);
loadDemoButton.addEventListener("click", () => {
  bulkCsv.value = demoCsv;
  renderBulkReport();
});
clearBulkButton.addEventListener("click", () => {
  bulkCsv.value = "";
  latestBulkRows = [];
  renderBulkReport();
});
runBulkButton.addEventListener("click", renderBulkReport);
exportBulkButton.addEventListener("click", exportBulkReport);
printReportButton.addEventListener("click", () => window.print());
copySingleButton.dataset.original = copySingleButton.textContent;
copySingleButton.addEventListener("click", () => copyText(buildSingleReportText(), copySingleButton));
if (exportButton) {
  exportButton.addEventListener("click", exportLeads);
}

if (clearButton) {
  clearButton.addEventListener("click", clearLeads);
}

renderResult();
updateLeadCount();
bulkCsv.value = demoCsv;
renderBulkReport();
