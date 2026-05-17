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
const saveCalculationButton = document.querySelector("#save-calculation");
const saveCalculationNote = document.querySelector("#save-calculation-note");
const downloadTemplateButton = document.querySelector("#download-template");
const uploadCsvInput = document.querySelector("#upload-csv");
const leadReportLink = document.querySelector("#lead-report-link");
const bulkNote = document.querySelector("#bulk-note");
const isEnglish = document.documentElement.lang.startsWith("en");
const marketSearchInput = document.querySelector("#market-search");
const marketComparisonSearchInput = document.querySelector("#market-comparison-search");
const marketComparisonSearchButton = document.querySelector("#market-comparison-search-button");
const freeQuotaNote = document.querySelector("#free-quota-note");
const tempLinkButton = document.querySelector("#create-temp-link");
const tempLinkNote = document.querySelector("#temp-link-note");
const quotaModal = document.querySelector("#quota-modal");
const quotaModalClose = document.querySelector("#quota-modal-close");

const freeQuotaLimit = 5;
const visitorIdKey = "skuauditpro-visitor-id";
const freeQuotaKey = "skuauditpro-free-quota";
let currentUser = null;
let authLoaded = false;
let latestSingleReport = null;

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
      leadSaved: "Saved. You can now follow up and ask for basic data from 5 SKUs.",
      noLeads: "No leads to export yet",
      templateFile: "skuauditpro-sku-template.csv",
      templateUploaded: "CSV uploaded. Review the rows, then generate the report.",
      reportCreated: (id) => `Report ID: ${id}. Track it here:`,
      reportPending: "Saved locally. Start the server to create a report ID.",
      savingCalculation: "Saving...",
      calculationSaved: "Saved to your dashboard.",
      loginToSave: "Please log in before saving calculation history.",
      saveFailed: "Could not save. Please try again.",
      marketAdded: (name) => `Added ${name} to the comparison.`,
      marketNotFound: "Country not found. Try its English name or 2-letter code.",
      freeQuota: (remaining) => `${remaining}/${freeQuotaLimit} free audits remaining.`,
      loggedInQuota: "You are logged in. Free audit limits do not apply.",
      quotaFinished: "Your free audits are used up. Please log in to continue generating audits.",
      loginLink: "Log in",
      tempLinkCreated: "Temporary report link:",
      targetPriceRange: (low, high) => `${low} - ${high}`,
      noReportYet: "Generate an audit first.",
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
      leadSaved: "已保存。现在可以联系对方要 5 个 SKU 的基础数据。",
      noLeads: "当前没有可导出的线索",
      templateFile: "skuauditpro-sku-template.csv",
      templateUploaded: "CSV 已上传。确认数据后可以生成体检报告。",
      reportCreated: (id) => `报告编号：${id}。客户可用这个链接查看进度：`,
      reportPending: "已保存在本地。启动后端服务后会自动生成报告编号。",
      savingCalculation: "正在保存...",
      calculationSaved: "已保存到你的计算记录。",
      loginToSave: "请先登录，再保存计算记录。",
      saveFailed: "保存失败，请稍后再试。",
      marketAdded: (name) => `已把 ${name} 加入对比。`,
      marketNotFound: "没有找到这个国家，请尝试中文名、英文名或两位国家代码。",
      freeQuota: (remaining) => `免费额度剩余 ${remaining}/${freeQuotaLimit} 次。`,
      loggedInQuota: "你已登录，不受免费额度限制。",
      quotaFinished: "免费额度已用完，请登录后继续生成利润体检。",
      loginLink: "去登录",
      tempLinkCreated: "临时报告链接：",
      targetPriceRange: (low, high) => `${low} - ${high}`,
      noReportYet: "请先生成利润体检。",
    };

const fields = [
  "platform",
  "market",
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
  "target-profit-rate",
];

const platformTemplates = {
  "TikTok Shop": {
    platformRate: 6,
    paymentRate: 2.9,
    affiliateRate: 15,
    returnRate: 8,
    adCost: 2.5,
    otherCost: 0.6,
    note: isEnglish
      ? "TikTok Shop template: marketplace fee, payment fee, creator commission and ad CPA assumptions."
      : "TikTok Shop 模板：已带入平台费、支付费、达人佣金和广告 CPA 假设。",
  },
  Shopify: {
    platformRate: 2,
    paymentRate: 2.9,
    affiliateRate: 0,
    returnRate: 7,
    adCost: 3.2,
    otherCost: 0.5,
    note: isEnglish
      ? "Shopify template: lower platform fee, higher paid traffic pressure and standard payment fee."
      : "Shopify 模板：平台费较低，但广告获客压力更高，支付费按常见水平估算。",
  },
  Amazon: {
    platformRate: 15,
    paymentRate: 0,
    affiliateRate: 0,
    returnRate: 8,
    adCost: 2.8,
    otherCost: 1.2,
    note: isEnglish
      ? "Amazon template: referral-style fee assumption plus fulfillment/other cost buffer."
      : "Amazon 模板：按销售佣金类费用和履约/其他成本缓冲估算。",
  },
  Walmart: {
    platformRate: 15,
    paymentRate: 0,
    affiliateRate: 0,
    returnRate: 7,
    adCost: 2.4,
    otherCost: 0.8,
    note: isEnglish
      ? "Walmart template: referral-style fee assumption with moderate return and ad pressure."
      : "Walmart 模板：按销售佣金类费用、适中退货和广告压力估算。",
  },
};

const allCountryCodes = [
  "AF", "AX", "AL", "DZ", "AS", "AD", "AO", "AI", "AQ", "AG", "AR", "AM", "AW", "AU", "AT", "AZ",
  "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BM", "BT", "BO", "BQ", "BA", "BW", "BV", "BR",
  "IO", "BN", "BG", "BF", "BI", "CV", "KH", "CM", "CA", "KY", "CF", "TD", "CL", "CN", "CX", "CC",
  "CO", "KM", "CG", "CD", "CK", "CR", "CI", "HR", "CU", "CW", "CY", "CZ", "DK", "DJ", "DM", "DO",
  "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FK", "FO", "FJ", "FI", "FR", "GF", "PF", "TF",
  "GA", "GM", "GE", "DE", "GH", "GI", "GR", "GL", "GD", "GP", "GU", "GT", "GG", "GN", "GW", "GY",
  "HT", "HM", "VA", "HN", "HK", "HU", "IS", "IN", "ID", "IR", "IQ", "IE", "IM", "IL", "IT", "JM",
  "JP", "JE", "JO", "KZ", "KE", "KI", "KP", "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY",
  "LI", "LT", "LU", "MO", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MQ", "MR", "MU", "YT", "MX",
  "FM", "MD", "MC", "MN", "ME", "MS", "MA", "MZ", "MM", "NA", "NR", "NP", "NL", "NC", "NZ", "NI",
  "NE", "NG", "NU", "NF", "MK", "MP", "NO", "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH",
  "PN", "PL", "PT", "PR", "QA", "RE", "RO", "RU", "RW", "BL", "SH", "KN", "LC", "MF", "PM", "VC",
  "WS", "SM", "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SX", "SK", "SI", "SB", "SO", "ZA", "GS",
  "SS", "ES", "LK", "SD", "SR", "SJ", "SE", "CH", "SY", "TW", "TJ", "TZ", "TH", "TL", "TG", "TK",
  "TO", "TT", "TN", "TR", "TM", "TC", "TV", "UG", "UA", "AE", "GB", "US", "UM", "UY", "UZ", "VU",
  "VE", "VN", "VG", "VI", "WF", "EH", "YE", "ZM", "ZW", "XK",
];

const countryNameFallbacks = {
  XK: isEnglish ? "Kosovo" : "\u79d1\u7d22\u6c83",
};

const countrySearchAliases = {
  US: ["usa", "america", "\u7f8e\u56fd", "\u7f8e\u5229\u575a"],
  GB: ["uk", "britain", "england", "\u82f1\u56fd", "\u82f1\u683c\u5170"],
  AE: ["uae", "\u963f\u8054\u914b"],
  KR: ["korea", "south korea", "\u97e9\u56fd"],
  KP: ["north korea", "\u671d\u9c9c"],
  RU: ["russia", "\u4fc4\u7f57\u65af"],
  VN: ["vietnam", "\u8d8a\u5357"],
  ID: ["indonesia", "\u5370\u5c3c", "\u5370\u5ea6\u5c3c\u897f\u4e9a"],
  XK: ["kosovo", "\u79d1\u7d22\u6c83"],
};

const tradeMarketIds = [
  "US", "GB", "DE", "FR", "IT", "ES", "NL", "PL", "CA", "MX", "BR", "AU", "JP", "KR", "SG", "MY",
  "TH", "VN", "PH", "ID", "IN", "AE", "SA", "TR", "ZA", "CL",
];

const marketProfileOverrides = {
  US: { shippingMultiplier: 1, dutyMultiplier: 1 },
  GB: { shippingMultiplier: 1.12, dutyMultiplier: 1.18 },
  DE: { shippingMultiplier: 1.18, dutyMultiplier: 1.22 },
  CA: { shippingMultiplier: 1.1, dutyMultiplier: 1.12 },
  FR: { shippingMultiplier: 1.18, dutyMultiplier: 1.21 },
  IT: { shippingMultiplier: 1.2, dutyMultiplier: 1.23 },
  ES: { shippingMultiplier: 1.16, dutyMultiplier: 1.2 },
  NL: { shippingMultiplier: 1.14, dutyMultiplier: 1.18 },
  PL: { shippingMultiplier: 1.18, dutyMultiplier: 1.2 },
  AU: { shippingMultiplier: 1.25, dutyMultiplier: 1.12 },
  NZ: { shippingMultiplier: 1.3, dutyMultiplier: 1.1 },
  JP: { shippingMultiplier: 1.05, dutyMultiplier: 1.08 },
  KR: { shippingMultiplier: 1.08, dutyMultiplier: 1.1 },
  SG: { shippingMultiplier: 0.9, dutyMultiplier: 0.95 },
  MY: { shippingMultiplier: 0.95, dutyMultiplier: 1 },
  TH: { shippingMultiplier: 0.98, dutyMultiplier: 1.02 },
  VN: { shippingMultiplier: 1.02, dutyMultiplier: 1.05 },
  PH: { shippingMultiplier: 1.05, dutyMultiplier: 1.05 },
  ID: { shippingMultiplier: 1.08, dutyMultiplier: 1.08 },
  IN: { shippingMultiplier: 1.12, dutyMultiplier: 1.14 },
  MX: { shippingMultiplier: 1.2, dutyMultiplier: 1.12 },
  BR: { shippingMultiplier: 1.35, dutyMultiplier: 1.35 },
  AE: { shippingMultiplier: 1.05, dutyMultiplier: 1 },
  SA: { shippingMultiplier: 1.08, dutyMultiplier: 1.05 },
  TR: { shippingMultiplier: 1.14, dutyMultiplier: 1.12 },
  ZA: { shippingMultiplier: 1.25, dutyMultiplier: 1.18 },
  CL: { shippingMultiplier: 1.24, dutyMultiplier: 1.12 },
};

const europeMarketIds = new Set([
  "AL", "AD", "AT", "AX", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DK", "EE", "FI", "FO", "GG",
  "GI", "GR", "HR", "HU", "IE", "IM", "IS", "JE", "LI", "LT", "LU", "LV", "MC", "MD", "ME", "MK",
  "MT", "NO", "PT", "RO", "RS", "SE", "SI", "SK", "SM", "UA", "VA", "XK",
]);
const asiaPacificMarketIds = new Set([
  "AS", "BD", "BN", "BT", "CC", "CN", "CX", "FJ", "FM", "GU", "HK", "KH", "KI", "LA", "LK", "MH",
  "MM", "MN", "MO", "MV", "NC", "NP", "NR", "NU", "PF", "PG", "PK", "PW", "SB", "TL", "TO", "TV",
  "TW", "VU", "WF", "WS",
]);
const middleEastMarketIds = new Set(["BH", "EG", "IL", "IQ", "IR", "JO", "KW", "LB", "OM", "PS", "QA", "SY", "YE"]);
const latinAmericaMarketIds = new Set([
  "AG", "AI", "AR", "AW", "BB", "BL", "BO", "BQ", "BS", "BZ", "CO", "CR", "CU", "CW", "DM", "DO",
  "EC", "FK", "GD", "GF", "GP", "GT", "GY", "HN", "HT", "JM", "KY", "LC", "MF", "MQ", "MS", "NI",
  "PA", "PE", "PM", "PR", "PY", "SR", "SX", "TC", "TT", "UY", "VC", "VE", "VG", "VI",
]);
const africaMarketIds = new Set([
  "AO", "BF", "BI", "BJ", "BW", "CD", "CF", "CG", "CI", "CM", "CV", "DJ", "DZ", "ER", "ET", "GA",
  "GH", "GM", "GN", "GQ", "GW", "KE", "KM", "LR", "LS", "LY", "MA", "MG", "ML", "MR", "MU", "MW",
  "MZ", "NA", "NE", "NG", "RE", "RW", "SC", "SD", "SH", "SL", "SN", "SO", "SS", "ST", "SZ", "TD",
  "TG", "TN", "TZ", "UG", "YT", "ZM", "ZW",
]);

const displayNames = new Intl.DisplayNames([isEnglish ? "en" : "zh-CN"], { type: "region" });
const englishDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

function getCountryName(code, english = isEnglish) {
  if (countryNameFallbacks[code] && english === isEnglish) {
    return countryNameFallbacks[code];
  }

  try {
    return (english ? englishDisplayNames : displayNames).of(code) || code;
  } catch {
    return countryNameFallbacks[code] || code;
  }
}

function defaultMarketProfile(code) {
  if (marketProfileOverrides[code]) {
    return marketProfileOverrides[code];
  }
  if (europeMarketIds.has(code)) {
    return { shippingMultiplier: 1.18, dutyMultiplier: 1.2 };
  }
  if (asiaPacificMarketIds.has(code)) {
    return { shippingMultiplier: 1.08, dutyMultiplier: 1.06 };
  }
  if (middleEastMarketIds.has(code)) {
    return { shippingMultiplier: 1.1, dutyMultiplier: 1.08 };
  }
  if (latinAmericaMarketIds.has(code)) {
    return { shippingMultiplier: 1.25, dutyMultiplier: 1.16 };
  }
  if (africaMarketIds.has(code)) {
    return { shippingMultiplier: 1.25, dutyMultiplier: 1.15 };
  }
  return { shippingMultiplier: 1.18, dutyMultiplier: 1.12 };
}

const marketProfiles = allCountryCodes
  .map((code) => ({
    id: code,
    name: getCountryName(code),
    englishName: getCountryName(code, true),
    ...defaultMarketProfile(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, isEnglish ? "en" : "zh-CN"));

const marketById = new Map(marketProfiles.map((market) => [market.id, market]));
let comparisonMarketIds = [];

const getNumber = (id) => {
  const value = Number.parseFloat(document.querySelector(`#${id}`).value);
  return Number.isFinite(value) ? value : 0;
};

function normalizeSearchValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findMarket(query) {
  const normalized = normalizeSearchValue(query);
  if (!normalized) {
    return null;
  }

  const code = normalized.toUpperCase();
  if (code === "UK") {
    return marketById.get("GB");
  }
  if (marketById.has(code)) {
    return marketById.get(code);
  }

  return (
    marketProfiles.find((market) => {
      const values = [
        market.id,
        market.name,
        market.englishName,
        ...(countrySearchAliases[market.id] || []),
      ].map(normalizeSearchValue);
      return values.some((value) => value === normalized);
    }) ||
    marketProfiles.find((market) => {
      const values = [
        market.name,
        market.englishName,
        ...(countrySearchAliases[market.id] || []),
      ].map(normalizeSearchValue);
      return values.some((value) => value.includes(normalized));
    }) ||
    null
  );
}

function populateMarketControls() {
  const marketSelect = document.querySelector("#market");
  const datalist = document.querySelector("#country-options");
  if (!marketSelect) {
    return;
  }

  marketSelect.innerHTML = marketProfiles
    .map((market) => `<option value="${market.id}">${escapeHtml(market.name)}</option>`)
    .join("");
  marketSelect.value = "US";
  if (marketSearchInput) {
    marketSearchInput.value = marketById.get("US")?.name || "United States";
  }

  if (datalist) {
    datalist.innerHTML = marketProfiles
      .map((market) => `<option value="${escapeHtml(market.name)}">${escapeHtml(market.englishName)} · ${market.id}</option>`)
      .join("");
  }
}

function getVisitorId() {
  let visitorId = localStorage.getItem(visitorIdKey);
  if (!visitorId) {
    visitorId =
      window.crypto?.randomUUID?.() ||
      `visitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(visitorIdKey, visitorId);
  }
  return visitorId;
}

function getFreeQuotaState() {
  const visitorId = getVisitorId();
  try {
    const saved = JSON.parse(localStorage.getItem(freeQuotaKey) || "{}");
    if (saved.visitorId === visitorId) {
      return {
        visitorId,
        used: Math.min(Math.max(Number(saved.used) || 0, 0), freeQuotaLimit),
      };
    }
  } catch {
    // Reset malformed quota records for this browser.
  }
  return { visitorId, used: 0 };
}

function saveFreeQuotaState(state) {
  localStorage.setItem(
    freeQuotaKey,
    JSON.stringify({
      visitorId: state.visitorId,
      used: Math.min(Math.max(Number(state.used) || 0, 0), freeQuotaLimit),
      updatedAt: new Date().toISOString(),
    }),
  );
}

function freeQuotaRemaining() {
  return Math.max(0, freeQuotaLimit - getFreeQuotaState().used);
}

function updateFreeQuotaNote(message = "") {
  if (!freeQuotaNote) {
    return;
  }
  if (message) {
    freeQuotaNote.innerHTML = message;
    return;
  }
  freeQuotaNote.textContent = currentUser ? text.loggedInQuota : text.freeQuota(freeQuotaRemaining());
}

function showQuotaModal() {
  if (quotaModal) {
    quotaModal.removeAttribute("hidden");
  }
}

function hideQuotaModal() {
  if (quotaModal) {
    quotaModal.setAttribute("hidden", "");
  }
}

async function loadCurrentUser() {
  if (authLoaded) {
    return currentUser;
  }
  try {
    const response = await fetch("/api/me");
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user || null;
    }
  } catch {
    currentUser = null;
  }
  authLoaded = true;
  updateFreeQuotaNote();
  return currentUser;
}

async function consumeFreeQuota() {
  const user = await loadCurrentUser();
  if (user) {
    updateFreeQuotaNote();
    return true;
  }

  const state = getFreeQuotaState();
  if (state.used >= freeQuotaLimit) {
    updateFreeQuotaNote(`${text.quotaFinished} <a href="/login">${text.loginLink}</a>`);
    showQuotaModal();
    return false;
  }

  state.used += 1;
  saveFreeQuotaState(state);
  updateFreeQuotaNote();
  return true;
}

function resetComparisonMarkets(targetId = document.querySelector("#market")?.value || "US") {
  comparisonMarketIds = [
    targetId,
    ...tradeMarketIds.filter((id) => id !== targetId),
  ].slice(0, 5);
}

function selectTargetMarketFromSearch() {
  const market = findMarket(marketSearchInput?.value);
  if (!market) {
    marketSearchInput.value = marketById.get(document.querySelector("#market")?.value || "US")?.name || "";
    marketSearchInput.placeholder = text.marketNotFound;
    return;
  }

  document.querySelector("#market").value = market.id;
  if (marketSearchInput) {
    marketSearchInput.value = market.name;
  }
  resetComparisonMarkets(market.id);
  renderMarketComparison(getCurrentInputs());
  rememberCurrentInputs();
}

function addComparisonMarket(market) {
  if (!market || comparisonMarketIds.includes(market.id)) {
    return;
  }
  comparisonMarketIds = [...comparisonMarketIds, market.id];
}

function searchComparisonMarket() {
  const market = findMarket(marketComparisonSearchInput?.value);
  if (!market) {
    if (marketComparisonSearchInput) {
      marketComparisonSearchInput.value = "";
      marketComparisonSearchInput.placeholder = text.marketNotFound;
    }
    return;
  }

  addComparisonMarket(market);
  if (marketComparisonSearchInput) {
    marketComparisonSearchInput.value = market.name;
    marketComparisonSearchInput.placeholder = text.marketAdded(market.name);
  }
  renderMarketComparison(getCurrentInputs());
}

function removeComparisonMarket(marketId) {
  comparisonMarketIds = comparisonMarketIds.filter((id) => id !== marketId);
  renderMarketComparison(getCurrentInputs());
}

const getLeads = () => JSON.parse(localStorage.getItem("skuprofit-leads") || "[]");
const saveLeads = (leads) => localStorage.setItem("skuprofit-leads", JSON.stringify(leads));
const lastInputsKey = "skuauditpro-last-inputs";
const editInputsKey = "skuauditpro-edit-inputs";

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
let hasGeneratedSingleReport = false;

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
  const targetProfitRate = Math.max(0.01, (Number(data.targetProfitRate) || 12) / 100);

  const variableFees = price * (platformRate + paymentRate + affiliateRate);
  const returnLoss = (cost + shipping + duty + otherCost) * returnRate;
  const totalCost = cost + shipping + duty + variableFees + adCost + returnLoss + otherCost;
  const netProfit = price - totalCost;
  const margin = price > 0 ? netProfit / price : 0;
  const fixedCost = cost + shipping + duty + adCost + returnLoss + otherCost;
  const rateCost = platformRate + paymentRate + affiliateRate;
  const breakEven = rateCost < 1 ? fixedCost / (1 - rateCost) : 0;
  const maxAffiliateRate = Math.max(
    0,
    1 - targetProfitRate - platformRate - paymentRate - fixedCost / Math.max(price, 0.01),
  );
  const targetPrice = rateCost + targetProfitRate < 1 ? fixedCost / (1 - rateCost - targetProfitRate) : 0;

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
    returnRate,
    cost,
    otherCost,
    targetProfitRate,
    targetPrice,
    fixedCost,
    rateCost,
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
    targetProfitRate: getNumber("target-profit-rate"),
  });
}

function getCurrentInputs() {
  return {
    platform: document.querySelector("#platform").value,
    market: document.querySelector("#market")?.value || "US",
    sku: document.querySelector("#sku-name").value.trim(),
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
    targetProfitRate: getNumber("target-profit-rate"),
  };
}

function fillInputs(inputs) {
  if (!inputs) {
    return;
  }

  const map = {
    platform: "platform",
    market: "market",
    sku: "sku-name",
    price: "price",
    cost: "cost",
    shipping: "shipping",
    duty: "duty",
    platformRate: "platform-rate",
    paymentRate: "payment-rate",
    affiliateRate: "affiliate-rate",
    adCost: "ad-cost",
    returnRate: "return-rate",
    otherCost: "other-cost",
    targetProfitRate: "target-profit-rate",
  };

  Object.entries(map).forEach(([key, id]) => {
    const field = document.querySelector(`#${id}`);
    if (field && inputs[key] !== undefined) {
      field.value = key === "market" && inputs[key] === "UK" ? "GB" : inputs[key];
      if (key === "market" && marketSearchInput) {
        marketSearchInput.value = marketById.get(field.value)?.name || marketSearchInput.value;
        resetComparisonMarkets(field.value);
      }
    }
  });
}

function rememberCurrentInputs() {
  localStorage.setItem(lastInputsKey, JSON.stringify(getCurrentInputs()));
}

function hydrateSavedInputs() {
  const editInputs = localStorage.getItem(editInputsKey);
  const lastInputs = localStorage.getItem(lastInputsKey);
  const raw = editInputs || lastInputs;
  if (!raw) {
    return;
  }

  try {
    fillInputs(JSON.parse(raw));
    if (editInputs) {
      localStorage.removeItem(editInputsKey);
      document.querySelector("#calculator").scrollIntoView({ behavior: "smooth" });
    }
  } catch {
    localStorage.removeItem(editInputsKey);
  }
}

function hydrateTemporaryReportFromUrl() {
  const encodedReport = new URLSearchParams(window.location.hash.slice(1)).get("report");
  if (!encodedReport) {
    return false;
  }

  try {
    const report = JSON.parse(decodeURIComponent(escape(window.atob(encodedReport))));
    if (!report?.inputs) {
      return false;
    }
    fillInputs(report.inputs);
    renderResult();
    document.querySelector("#calculator")?.scrollIntoView({ behavior: "smooth" });
    return true;
  } catch {
    return false;
  }
}

function buildAdvice(result) {
  const advice = [];

  if (result.margin < 0) {
    advice.push(text.adviceLoss);
  } else if (result.margin < result.targetProfitRate) {
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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function suggestedPriceRange(result) {
  const target = result.targetPrice || result.breakEven;
  if (!target || !Number.isFinite(target)) {
    return "-";
  }
  return text.targetPriceRange(money.format(target * 1.02), money.format(target * 1.12));
}

function psychologicalPrice(value) {
  if (!value || !Number.isFinite(value)) {
    return 0;
  }
  const floor = Math.floor(value);
  return Math.max(0.99, floor + 0.99);
}

function suggestedPriceNote(result) {
  const price = psychologicalPrice(result.targetPrice || result.breakEven);
  if (!price) {
    return isEnglish ? "Review costs before setting a target price." : "先复核成本，再设置目标售价。";
  }
  return isEnglish
    ? `Test ${money.format(price)} first. Range: ${suggestedPriceRange(result)}`
    : `建议先测 ${money.format(price)}，可测试区间 ${suggestedPriceRange(result)}`;
}

function decisionCopy(result, driver) {
  if (result.margin < 0) {
    return {
      title: isEnglish ? "Pause scaling" : "先暂停放量",
      action: isEnglish ? "Fix the main cost leak before buying more traffic." : "先处理主要成本漏洞，再继续投流。",
    };
  }
  if (result.margin < result.targetProfitRate) {
    return {
      title: isEnglish ? "Optimize before scaling" : "先优化再放量",
      action: isEnglish ? `${driver.title}. Try the suggested price and retest.` : `${driver.title}。先测试建议售价，再复盘利润。`,
    };
  }
  return {
    title: isEnglish ? "Keep testing" : "可以继续测试",
    action: isEnglish ? "Keep traffic controlled and test the suggested price point." : "保留投放，先测试建议售价和目标市场。",
  };
}

function getLossDriver(inputs, result) {
  const price = Math.max(result.price || Number(inputs.price) || 0, 0.01);
  const drivers = [
    {
      key: "shipping",
      title: isEnglish ? "Logistics is eating margin" : "物流成本吃掉利润",
      detail: isEnglish
        ? "Try bundle packs, overseas stock, lighter packaging or a higher price point."
        : "优先测试组合装、海外仓、轻包装，或者提高售价区间。",
      score: (Number(inputs.shipping) + Number(inputs.duty)) / price,
    },
    {
      key: "commission",
      title: isEnglish ? "Commission is too high" : "达人佣金偏高",
      detail: isEnglish
        ? "Keep creator commission below the suggested ceiling before scaling."
        : "放量前把达人佣金控制在建议上限以内。",
      score: Number(inputs.affiliateRate) / 100,
    },
    {
      key: "ads",
      title: isEnglish ? "Ad cost needs a tighter ceiling" : "广告成本需要设上限",
      detail: isEnglish
        ? "Set a unit CPA ceiling and pause creatives that cannot stay below it."
        : "给单件广告 CPA 设上限，超过上限的素材先暂停。",
      score: Number(inputs.adCost) / price,
    },
    {
      key: "returns",
      title: isEnglish ? "Return loss can flip profit" : "退货损耗会吞利润",
      detail: isEnglish
        ? "Improve size, fit, material and expectation-setting on the product page."
        : "优先优化尺寸、材质、使用预期和详情页说明。",
      score: Number(inputs.returnRate) / 100,
    },
    {
      key: "cost",
      title: isEnglish ? "Product cost leaves little room" : "采购成本空间偏小",
      detail: isEnglish
        ? "Negotiate landed cost or move this SKU into a higher-value bundle."
        : "尝试压低到岸成本，或把这个 SKU 放进更高客单价组合。",
      score: Number(inputs.cost) / price,
    },
  ].sort((a, b) => b.score - a.score);

  const driver = drivers[0];
  if (result.margin >= result.targetProfitRate && driver.score < 0.18) {
    return {
      title: isEnglish ? "No major leak found" : "暂无明显利润漏洞",
      detail: isEnglish
        ? "Current assumptions still leave enough margin. Keep monitoring ads and returns while scaling."
        : "当前假设下利润空间还可以，放量时重点继续监控广告和退货。",
    };
  }
  return driver;
}

function marketRecommendation(row, index) {
  if (index === 0) {
    return { label: isEnglish ? "Target" : "目标市场", className: "" };
  }
  if (row.result.margin < 0) {
    return { label: isEnglish ? "Avoid" : "暂缓", className: "bad" };
  }
  if (row.result.margin < 0.12) {
    return { label: isEnglish ? "Watch" : "谨慎", className: "watch" };
  }
  return { label: isEnglish ? "Test" : "可测试", className: "" };
}

function applyPlatformTemplate() {
  const platform = document.querySelector("#platform").value;
  const template = platformTemplates[platform];
  if (!template) {
    renderTemplateNote();
    return;
  }

  const pairs = {
    "platform-rate": template.platformRate,
    "payment-rate": template.paymentRate,
    "affiliate-rate": template.affiliateRate,
    "ad-cost": template.adCost,
    "return-rate": template.returnRate,
    "other-cost": template.otherCost,
  };

  Object.entries(pairs).forEach(([id, value]) => {
    const field = document.querySelector(`#${id}`);
    if (field) {
      field.value = value;
    }
  });

  if (hasGeneratedSingleReport) {
    renderResult();
  } else {
    renderTemplateNote();
  }
  rememberCurrentInputs();
}

function renderTemplateNote() {
  const platform = document.querySelector("#platform").value;
  const template = platformTemplates[platform];
  const title = document.querySelector("#fee-template-title");
  const note = document.querySelector("#fee-template-note");
  if (!title || !note) {
    return;
  }

  title.textContent = platform;
  note.textContent =
    template?.note ||
    (isEnglish
      ? "Custom platform: edit each fee input manually to match your current channel."
      : "自定义平台：请手动调整各项费率，让它更接近你的实际渠道。");
}

function renderMarketComparison(inputs) {
  const container = document.querySelector("#market-comparison-results");
  if (!container) {
    return;
  }

  if (!comparisonMarketIds.length) {
    resetComparisonMarkets(inputs.market || "US");
  }

  const rows = comparisonMarketIds
    .map((id) => marketById.get(id))
    .filter(Boolean)
    .map((market, index) => {
      const result = calculateFromData({
        ...inputs,
        shipping: inputs.shipping * market.shippingMultiplier,
        duty: inputs.duty * market.dutyMultiplier,
      });
      const row = { market, result, risk: getRisk(result) };
      return { ...row, recommendation: marketRecommendation(row, index) };
    });

  container.innerHTML = rows
    .map(
      (row) => `
        <div class="mini-row">
          <span>${escapeHtml(row.market.name)}</span>
          <strong>${money.format(row.result.netProfit)}</strong>
          <span>${formatPercent(row.result.margin)}</span>
          <span class="risk-chip ${row.risk.className}">${row.risk.label}</span>
          <span class="market-recommendation ${row.recommendation.className}">${row.recommendation.label}</span>
          <button class="mini-remove" data-remove-market="${escapeHtml(row.market.id)}" type="button">${isEnglish ? "Remove" : "删除"}</button>
        </div>
      `,
    )
    .join("");

  container.querySelectorAll("[data-remove-market]").forEach((button) => {
    button.addEventListener("click", () => removeComparisonMarket(button.dataset.removeMarket));
  });
}

function renderSensitivity(inputs) {
  const container = document.querySelector("#sensitivity-results");
  if (!container) {
    return;
  }

  const scenarios = [
    {
      name: isEnglish ? "If ad cost rises 20%" : "广告成本贵 20%",
      data: { ...inputs, adCost: inputs.adCost * 1.2 },
    },
    {
      name: isEnglish ? "If returns rise 5 pts" : "退货率多 5 个点",
      data: { ...inputs, returnRate: inputs.returnRate + 5 },
    },
    {
      name: isEnglish ? "If commission rises 5 pts" : "达人佣金多 5 个点",
      data: { ...inputs, affiliateRate: inputs.affiliateRate + 5 },
    },
    {
      name: isEnglish ? "If shipping rises 15%" : "物流成本贵 15%",
      data: { ...inputs, shipping: inputs.shipping * 1.15 },
    },
  ];

  container.innerHTML = scenarios
    .map((scenario, index) => {
      const result = calculateFromData(scenario.data);
      const risk = getRisk(result);
      if (index === scenarios.length - 1) {
        const summary = document.querySelector("#sensitivity-summary");
        if (summary) {
          summary.textContent =
            result.margin >= 0
              ? (isEnglish ? `Still ${formatPercent(result.margin)} margin if shipping rises` : `物流上涨后仍有 ${formatPercent(result.margin)} 净利率`)
              : (isEnglish ? "Stress test shows loss risk" : "压力测试出现亏损风险");
        }
      }
      return `
        <div class="mini-row">
          <span>${escapeHtml(scenario.name)}</span>
          <strong>${money.format(result.netProfit)}</strong>
          <span>${formatPercent(result.margin)}</span>
          <span class="risk-chip ${risk.className}">${risk.label}</span>
        </div>
      `;
    })
    .join("");
}

function renderComplianceHints(inputs, result) {
  const list = document.querySelector("#compliance-list");
  if (!list) {
    return;
  }

  const sku = `${inputs.sku} ${inputs.platform}`.toLowerCase();
  const hints = [];
  const pushHint = (value) => {
    if (!hints.includes(value)) {
      hints.push(value);
    }
  };

  if (/led|lamp|light|battery|charger|usb|electronic|电|灯|充电|电池|补光/.test(sku)) {
    pushHint(isEnglish ? "Electronics: confirm labels, safety certification, battery and adapter rules before listing." : "带电/电子类：上架前确认标签、安全认证、电池和适配器规则。");
  }
  if (/kids|baby|toy|child|儿童|婴儿|玩具/.test(sku)) {
    pushHint(isEnglish ? "Children's products: check age labels, safety tests and marketplace restrictions." : "儿童用品：确认年龄标签、安全测试和平台限制。");
  }
  if (/cosmetic|cream|makeup|skin|化妆|护肤|面霜/.test(sku)) {
    pushHint(isEnglish ? "Cosmetics: verify ingredients, labels and importer responsibility before scaling." : "化妆品/护肤类：放量前确认成分、标签和进口责任。");
  }
  if (/food|kitchen|silicone|cup|食品|厨房|硅胶|杯/.test(sku)) {
    pushHint(isEnglish ? "Food-contact items: check material declaration and food-contact rules." : "食品接触类：确认材质声明和食品接触合规要求。");
  }
  if (result.margin < result.targetProfitRate) {
    pushHint(isEnglish ? "Business risk: margin is thin, so returns or compliance delays can quickly turn this SKU unprofitable." : "经营风险：利润较薄，退货或合规延误都可能很快把这个 SKU 拉成亏损。");
  }
  if (!hints.length) {
    pushHint(isEnglish ? "No obvious category alert from the SKU name. Use this as a screening hint, not legal, tax or customs advice." : "从 SKU 名称暂未识别明显品类风险。本提示仅作初筛，不替代正式报关、税务或法律意见。");
  }

  list.innerHTML = hints.map((hint) => `<li>${escapeHtml(hint)}</li>`).join("");
  const summary = document.querySelector("#compliance-summary");
  if (summary) {
    summary.textContent = hints.length > 1 ? (isEnglish ? `${hints.length} checks` : `${hints.length} 个检查项`) : hints[0].split(/[。.:：]/)[0];
  }
}

function renderCostBreakdown(inputs, result) {
  const container = document.querySelector("#cost-breakdown");
  if (!container) {
    return;
  }
  const price = Math.max(result.price || 0, 0.01);
  const rows = [
    { label: isEnglish ? "Product cost" : "采购成本", value: result.cost },
    { label: isEnglish ? "Logistics + duty" : "物流+关税", value: result.shipping + result.duty },
    { label: isEnglish ? "Platform/payment" : "平台/支付费", value: price * ((Number(inputs.platformRate) + Number(inputs.paymentRate)) / 100) },
    { label: isEnglish ? "Commission" : "达人佣金", value: price * (Number(inputs.affiliateRate) / 100) },
    { label: isEnglish ? "Ads" : "广告成本", value: result.adCost },
    { label: isEnglish ? "Return loss" : "退货损耗", value: result.returnLoss },
  ].sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((row) => row.value), 0.01);

  container.innerHTML = rows
    .map(
      (row) => `
        <div class="cost-row">
          <div>
            <span>${escapeHtml(row.label)}</span>
            <strong>${money.format(row.value)}</strong>
          </div>
          <div class="cost-track"><span style="width: ${Math.min(100, Math.max(4, (row.value / max) * 100))}%"></span></div>
        </div>
      `,
    )
    .join("");
}

function renderActionPlan(result, driver) {
  const container = document.querySelector("#action-plan");
  if (!container) {
    return;
  }
  const suggested = psychologicalPrice(result.targetPrice || result.breakEven);
  const actions = [
    {
      label: isEnglish ? "Do first" : "先做",
      text: suggested
        ? (isEnglish ? `Test ${money.format(suggested)} as the first price point.` : `先测试 ${money.format(suggested)} 这个心理价位。`)
        : (isEnglish ? "Review cost inputs before choosing a price." : "先复核成本输入，再决定售价。"),
    },
    {
      label: isEnglish ? "Then" : "再做",
      text: driver.detail,
    },
    {
      label: isEnglish ? "Hold" : "暂缓",
      text: isEnglish
        ? `Do not raise commission above ${formatPercent(result.maxAffiliateRate)} until margin improves.`
        : `利润改善前，不建议把佣金提高到 ${formatPercent(result.maxAffiliateRate)} 以上。`,
    },
  ];

  container.innerHTML = actions
    .map(
      (action) => `
        <article>
          <span>${escapeHtml(action.label)}</span>
          <p>${escapeHtml(action.text)}</p>
        </article>
      `,
    )
    .join("");
}

function renderProfessionalInsights(result) {
  const inputs = getCurrentInputs();
  renderTemplateNote();
  renderMarketComparison(inputs);
  renderSensitivity(inputs);
  renderComplianceHints(inputs, result);
}

function renderResult() {
  hasGeneratedSingleReport = true;
  const result = calculateProfit();
  document.querySelector("#single-result-panel")?.removeAttribute("hidden");
  const badge = document.querySelector("#risk-badge");
  const summary = document.querySelector("#result-summary");
  const adviceList = document.querySelector("#advice-list");

  badge.classList.remove("warning", "danger");

  if (result.margin < 0) {
    badge.textContent = text.loss;
    badge.classList.add("danger");
    summary.textContent = text.lossSummary;
  } else if (result.margin < result.targetProfitRate) {
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
  const driver = getLossDriver(getCurrentInputs(), result);
  const decision = decisionCopy(result, driver);
  document.querySelector("#decision-title").textContent = decision.title;
  document.querySelector("#decision-action").textContent = decision.action;
  document.querySelector("#target-price").textContent = money.format(psychologicalPrice(result.targetPrice || result.breakEven));
  document.querySelector("#target-price-note").textContent = suggestedPriceNote(result);
  document.querySelector("#loss-driver-title").textContent = driver.title;
  document.querySelector("#loss-driver-detail").textContent = driver.detail;
  renderCostBreakdown(getCurrentInputs(), result);
  renderActionPlan(result, driver);

  if (adviceList) {
    adviceList.innerHTML = "";
    buildAdvice(result).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      adviceList.append(li);
    });
  }

  renderProfessionalInsights(result);
  latestSingleReport = {
    id: `local-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    inputs: getCurrentInputs(),
    result,
    recommendations: buildAdvice(result),
    driver,
  };
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
      <td>${escapeHtml(row.sku || text.unnamedSku)}</td>
      <td>${escapeHtml(row.platform || "-")}</td>
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

  const insights = document.querySelector("#bulk-insights");
  if (!insights) {
    return;
  }
  if (!count) {
    insights.innerHTML = `
      <div><span>${isEnglish ? "Bulk summary" : "批量摘要"}</span><strong>${isEnglish ? "Waiting for data" : "等待数据"}</strong></div>
      <p>${isEnglish ? "Upload or paste CSV data to summarize loss-making, thin-margin and priority SKUs." : "上传或粘贴 CSV 后会自动总结亏损、偏薄和优先处理 SKU。"}</p>
    `;
    return;
  }

  const thin = rows.filter((row) => row.result.margin >= 0 && row.result.margin < 0.12).length;
  const topPriority = rows.slice(0, 3).map((row) => row.sku || text.unnamedSku).join("、");
  insights.innerHTML = `
    <div>
      <span>${isEnglish ? "Bulk summary" : "批量摘要"}</span>
      <strong>${isEnglish ? `${loss} loss / ${thin} thin` : `${loss} 个亏损 / ${thin} 个偏薄`}</strong>
    </div>
    <p>${
      isEnglish
        ? `Review ${escapeHtml(topPriority)} first. They have the weakest margin or highest loss risk.`
        : `建议优先复盘 ${escapeHtml(topPriority)}。这些 SKU 净利率最低或亏损风险最高。`
    }</p>
  `;
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
  downloadCsv(csv, "skuauditpro-bulk-report.csv");
}

function downloadTemplate() {
  downloadCsv(demoCsv, text.templateFile);
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

function createTemporaryReportLink() {
  if (!latestSingleReport) {
    if (tempLinkNote) {
      tempLinkNote.textContent = text.noReportYet;
    }
    return;
  }

  try {
    const encodedReport = window.btoa(unescape(encodeURIComponent(JSON.stringify(latestSingleReport))));
    const url = new URL(window.location.href);
    url.searchParams.delete("localReport");
    url.hash = `report=${encodedReport}`;
    if (tempLinkNote) {
      tempLinkNote.innerHTML = `${text.tempLinkCreated} <a href="${url.toString()}">${url.toString()}</a>`;
    }
    copyText(url.toString(), tempLinkButton || { textContent: "" });
  } catch {
    if (tempLinkNote) {
      tempLinkNote.textContent = isEnglish ? "Could not create a temporary link." : "临时链接生成失败，请稍后再试。";
    }
  }
}

async function copyText(value, successText) {
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
  const market = marketProfiles.find((item) => item.id === document.querySelector("#market")?.value)?.name || "US";
  const result = calculateProfit();
  const risk = getRisk(result);
  const driver = getLossDriver(getCurrentInputs(), result);

  return `${text.singleReportTitle}
${text.sku}: ${sku}
${text.platform}: ${platform}
${isEnglish ? "Market" : "目标市场"}: ${market}
${text.netProfit}: ${money.format(result.netProfit)}
${text.margin}: ${formatPercent(result.margin)}
${text.breakEven}: ${money.format(result.breakEven)}
${isEnglish ? "Suggested price" : "建议售价"}: ${suggestedPriceRange(result)}
${isEnglish ? "Main profit leak" : "主要利润漏洞"}: ${driver.title}
${text.maxAffiliate}: ${formatPercent(result.maxAffiliateRate)}
${text.risk}: ${risk.label}
${text.recommendations}:
${buildAdvice(result).map((item) => `- ${item}`).join("\n")}`;
}

async function saveCalculation() {
  const inputs = getCurrentInputs();
  const result = calculateProfit();
  const risk = getRisk(result);
  const recommendations = buildAdvice(result);

  saveCalculationNote.textContent = text.savingCalculation;

  try {
    const response = await fetch("/api/calculations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: inputs.sku || text.unnamedSku,
        platform: inputs.platform,
        inputs,
        result: {
          netProfit: result.netProfit,
          margin: result.margin,
          breakEven: result.breakEven,
          targetPrice: result.targetPrice,
          targetProfitRate: result.targetProfitRate,
          maxAffiliateRate: result.maxAffiliateRate,
          totalCost: result.totalCost,
        },
        risk: risk.label,
        recommendations,
      }),
    });

    if (response.status === 401) {
      saveCalculationNote.innerHTML = `${text.loginToSave} <a href="/login">Login</a>`;
      return;
    }

    if (!response.ok) {
      throw new Error("save failed");
    }

    rememberCurrentInputs();
    saveCalculationNote.innerHTML = `${text.calculationSaved} <a href="/dashboard.html#history">${isEnglish ? "View history" : "查看历史记录"}</a>`;
  } catch {
    saveCalculationNote.textContent = text.saveFailed;
  }
}

async function loadStats() {
  const formatStat = (value) => {
    const number = Number(value) || 0;
    if (number >= 1000) {
      return `${Math.floor(number / 100) / 10}k+`;
    }
    if (number >= 100) {
      return `${Math.floor(number / 10) * 10}+`;
    }
    return `${number}+`;
  };

  try {
    const response = await fetch("/api/stats");
    if (!response.ok) {
      return;
    }
    const stats = await response.json();
    document.querySelector("#stat-users").textContent = formatStat(stats.users);
    document.querySelector("#stat-calculations").textContent = formatStat(stats.calculations);
  } catch {
    // Static preview keeps the default counters.
  }
}

function updateLeadCount() {
  document.querySelector("#lead-count").textContent = text.leadCount(getLeads().length);
}

function showReportLink(lead) {
  if (!leadReportLink || !lead?.reportId) {
    if (leadReportLink) {
      leadReportLink.textContent = text.reportPending;
    }
    return;
  }

  const reportUrl = `${window.location.origin}/report.html?id=${encodeURIComponent(lead.reportId)}`;
  leadReportLink.innerHTML = "";
  const span = document.createElement("span");
  span.textContent = `${text.reportCreated(lead.reportId)} `;
  const link = document.createElement("a");
  link.href = reportUrl;
  link.textContent = reportUrl;
  link.target = "_blank";
  link.rel = "noreferrer";
  leadReportLink.append(span, link);
}

async function handleLeadSubmit(event) {
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

  try {
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lead),
    });
    if (response.ok) {
      const data = await response.json();
      Object.assign(lead, data.lead);
      saveLeads(leads);
      showReportLink(data.lead);
    } else {
      showReportLink(null);
    }
  } catch {
    showReportLink(null);
  }

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

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!(await consumeFreeQuota())) {
    return;
  }
  renderResult();
});

fields.forEach((id) => {
  document.querySelector(`#${id}`).addEventListener("input", () => {
    if (hasGeneratedSingleReport) {
      document.querySelector("#single-result-panel")?.setAttribute("hidden", "");
      hasGeneratedSingleReport = false;
    }
    renderTemplateNote();
    rememberCurrentInputs();
  });
});

document.querySelector("#platform").addEventListener("change", applyPlatformTemplate);
if (marketSearchInput) {
  marketSearchInput.addEventListener("change", selectTargetMarketFromSearch);
  marketSearchInput.addEventListener("blur", selectTargetMarketFromSearch);
  marketSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      selectTargetMarketFromSearch();
    }
  });
}
if (marketComparisonSearchButton) {
  marketComparisonSearchButton.addEventListener("click", searchComparisonMarket);
}
if (marketComparisonSearchInput) {
  marketComparisonSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchComparisonMarket();
    }
  });
}

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
downloadTemplateButton.addEventListener("click", downloadTemplate);
uploadCsvInput.addEventListener("change", async () => {
  const file = uploadCsvInput.files?.[0];
  if (!file) {
    return;
  }

  bulkCsv.value = await file.text();
  bulkNote.textContent = text.templateUploaded;
  renderBulkReport();
});
copySingleButton.dataset.original = copySingleButton.textContent;
copySingleButton.addEventListener("click", () => copyText(buildSingleReportText(), copySingleButton));
saveCalculationButton.addEventListener("click", saveCalculation);
if (tempLinkButton) {
  tempLinkButton.dataset.original = tempLinkButton.textContent;
  tempLinkButton.addEventListener("click", createTemporaryReportLink);
}
if (quotaModalClose) {
  quotaModalClose.addEventListener("click", hideQuotaModal);
}
if (quotaModal) {
  quotaModal.addEventListener("click", (event) => {
    if (event.target === quotaModal) {
      hideQuotaModal();
    }
  });
}
if (exportButton) {
  exportButton.addEventListener("click", exportLeads);
}

if (clearButton) {
  clearButton.addEventListener("click", clearLeads);
}

populateMarketControls();
hydrateSavedInputs();
renderTemplateNote();
getVisitorId();
loadCurrentUser();
updateFreeQuotaNote();
hydrateTemporaryReportFromUrl();
updateLeadCount();
bulkCsv.value = demoCsv;
renderBulkReport();
loadStats();
