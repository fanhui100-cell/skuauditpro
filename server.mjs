import http from "node:http";
import crypto from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = process.cwd();
const dataDir = join(root, "data");
const dbPath = join(dataDir, "db.json");

function loadEnvFile() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const rows = readFileSync(envPath, "utf-8").split(/\r?\n/);
  rows.forEach((row) => {
    const line = row.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      return;
    }

    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadEnvFile();

const port = Number(process.env.PORT || 4173);
const adminCode = process.env.ADMIN_CODE || "skuprofit-admin";

const plans = [
  {
    id: "free-3-sku",
    name: "免费测 5 个 SKU",
    priceCny: 0,
    priceHkd: 0,
    interval: "once",
    features: ["5 个 SKU 利润体检", "风险等级", "保本售价", "初步优化建议"],
  },
  {
    id: "audit-20-sku",
    name: "入门月度包",
    priceCny: 29,
    priceHkd: 32,
    interval: "month",
    popular: true,
    features: ["每月 20 个 SKU", "批量利润排序", "隐藏亏损品清单", "达人佣金上限"],
  },
  {
    id: "store-audit",
    name: "增长月度包",
    priceCny: 59,
    priceHkd: 65,
    interval: "month",
    features: ["每月 100 个 SKU", "定价建议", "物流/关税敏感性", "月度复盘摘要"],
  },
  {
    id: "pro-monthly",
    name: "服务商月度包",
    priceCny: 99,
    priceHkd: 108,
    interval: "month",
    features: ["每月 300 个 SKU", "SKU 利润看板", "批量 CSV 导出", "政策/费用变动记录"],
  },
];

const planQuotas = {
  "free-3-sku": 5,
  "audit-20-sku": 20,
  "store-audit": 100,
  "pro-monthly": 300,
};

const paymentMethods = [
  {
    id: "manual-cn-bank",
    name: "国内银行卡转账",
    currency: "CNY",
    status: "ready",
    note: "适合人民币付款。提交付款备注后，我们会核对收款并开通对应服务。",
  },
  {
    id: "manual-hk-bank",
    name: "香港银行卡 / FPS 转账",
    currency: "HKD",
    status: "ready",
    note: "适合香港账户付款，可通过银行转账或 FPS 完成付款确认。",
  },
  {
    id: "stripe-hk",
    name: "Stripe HK：信用卡 / Alipay / WeChat Pay",
    currency: "HKD/USD",
    status: process.env.STRIPE_SECRET_KEY ? "configurable" : "needs_keys",
    note: "支持信用卡和本地钱包付款，开通后可跳转到安全支付页面完成结算。",
  },
  {
    id: "manual-service",
    name: "人工对公/服务商代收",
    currency: "CNY/HKD",
    status: "ready",
    note: "适合服务商、团队或对公客户统一结算，付款后按约定开通服务。",
  },
];

const defaultCompanySettings = {
  companyName: "SKUAuditPro",
  legalName: "SKUAuditPro Advisory",
  email: "hello@skuauditpro.com",
  address: "Hong Kong / Remote",
  logoDataUrl: "",
  paymentInstructions:
    "Please complete payment by bank transfer, FPS or the agreed manual payment method. Include the invoice number in your payment note.",
};

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

async function loadDb() {
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }

  if (!existsSync(dbPath)) {
    await saveDb({
      users: [],
      sessions: [],
      orders: [],
      leads: [],
      calculations: [],
      visitors: [],
      quotes: [],
      invoices: [],
      settings: { company: defaultCompanySettings },
    });
  }

  const db = JSON.parse(await readFile(dbPath, "utf-8"));
  db.users ||= [];
  db.sessions ||= [];
  db.orders ||= [];
  db.leads ||= [];
  db.calculations ||= [];
  db.visitors ||= [];
  db.quotes ||= [];
  db.invoices ||= [];
  db.settings ||= {};
  db.settings.company = { ...defaultCompanySettings, ...(db.settings.company || {}) };
  return db;
}

async function saveDb(db) {
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf-8");
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function redirect(response, location) {
  response.writeHead(302, { Location: location });
  response.end();
}

function appendCookie(response, cookie) {
  const existing = response.getHeader("Set-Cookie");
  if (!existing) {
    response.setHeader("Set-Cookie", cookie);
    return;
  }

  response.setHeader("Set-Cookie", Array.isArray(existing) ? [...existing, cookie] : [existing, cookie]);
}

function publicBaseUrl(request) {
  return (process.env.APP_BASE_URL || `http://${request.headers.host}`).replace(/\/$/, "");
}

function preferredLanguage(request) {
  const cookieLang = parseCookies(request).lang;
  if (cookieLang === "zh" || cookieLang === "en") {
    return cookieLang;
  }

  const accepted = String(request.headers["accept-language"] || "").toLowerCase();
  return accepted.includes("zh") ? "zh" : "en";
}

function setLanguage(response, lang, next = "/") {
  const safeLang = lang === "en" ? "en" : "zh";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  response.writeHead(302, {
    Location: safeNext,
    "Set-Cookie": `lang=${safeLang}; Path=/; SameSite=Lax; Max-Age=31536000`,
  });
  response.end();
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, saved) {
  const [salt, hash] = saved.split(":");
  return hashPassword(password, salt).split(":")[1] === hash;
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    provider: user.provider,
    planId: user.planId || "free-3-sku",
    quota: quotaForPlan(user.planId || "free-3-sku"),
    onboarded: Boolean(user.onboarded),
    createdAt: user.createdAt,
  };
}

function quotaForPlan(planId) {
  return planQuotas[planId] ?? planQuotas["free-3-sku"];
}

function usageMonth(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function requestFingerprint(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const ip = forwarded || request.socket?.remoteAddress || "";
  const ua = String(request.headers["user-agent"] || "").slice(0, 200);
  return crypto.createHash("sha256").update(`${ip}|${ua}`).digest("hex");
}

function normalizeVisitorId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
}

function usageForIdentity(db, { userId = "", visitorId = "" }, month = usageMonth()) {
  return db.calculations.filter((item) => {
    if (String(item.usageMonth || item.createdAt?.slice(0, 7) || "") !== month) {
      return false;
    }
    return userId ? item.userId === userId : item.visitorId === visitorId;
  }).length;
}

function quotaStatus(db, identity, planId = "free-3-sku") {
  const limit = quotaForPlan(planId);
  const used = usageForIdentity(db, identity);
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    month: usageMonth(),
  };
}

function publicCalculation(calculation) {
  return {
    id: calculation.id,
    reportId: calculation.reportId || "",
    shareToken: calculation.shareToken,
    sku: calculation.sku,
    platform: calculation.platform,
    inputs: calculation.inputs,
    result: calculation.result,
    risk: calculation.risk,
    recommendations: calculation.recommendations,
    createdAt: calculation.createdAt,
  };
}

function reportSummaryFromCalculations(calculations) {
  const count = calculations.length;
  const lossCount = calculations.filter((item) => Number(item.result?.margin) < 0).length;
  const watchCount = calculations.filter((item) => {
    const margin = Number(item.result?.margin);
    return margin >= 0 && margin < 0.12;
  }).length;
  const healthyCount = Math.max(0, count - lossCount - watchCount);
  const avgMargin = count
    ? calculations.reduce((sum, item) => sum + (Number(item.result?.margin) || 0), 0) / count
    : 0;
  const totalNetProfit = calculations.reduce((sum, item) => sum + (Number(item.result?.netProfit) || 0), 0);
  const priority = [...calculations].sort((a, b) => (Number(a.result?.margin) || 0) - (Number(b.result?.margin) || 0))[0] || null;

  return {
    count,
    lossCount,
    watchCount,
    healthyCount,
    avgMargin,
    totalNetProfit,
    prioritySku: priority ? publicCalculation(priority) : null,
  };
}

function createReportId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SA-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function createSkuReportId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `SKU-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function createQuoteId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `QT-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function createInvoiceId() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `INV-${date}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function publicQuote(quote) {
  return {
    id: quote.id,
    quoteNo: quote.quoteNo,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    serviceName: quote.serviceName,
    planId: quote.planId || "",
    planName: quote.planName || "",
    amount: quote.amount,
    currency: quote.currency,
    status: quote.status,
    notes: quote.notes,
    invoiceId: quote.invoiceId || "",
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
    expiresAt: quote.expiresAt,
  };
}

function publicInvoice(invoice) {
  const effectiveStatus =
    invoice.status === "pending" && invoice.dueAt && new Date(invoice.dueAt).getTime() < Date.now()
      ? "overdue"
      : invoice.status;

  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    publicToken: invoice.publicToken || "",
    quoteId: invoice.quoteId || "",
    quoteNo: invoice.quoteNo || "",
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    serviceName: invoice.serviceName,
    planId: invoice.planId || "",
    planName: invoice.planName || "",
    amount: invoice.amount,
    currency: invoice.currency,
    status: effectiveStatus,
    notes: invoice.notes,
    issuedAt: invoice.issuedAt,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt || "",
    upgradedAt: invoice.upgradedAt || "",
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

function billingOverview(invoices) {
  const now = Date.now();
  return invoices.reduce(
    (summary, invoice) => {
      const amount = Number(invoice.amount) || 0;
      summary.total += amount;
      if (invoice.status === "paid") {
        summary.paid += amount;
      } else if (invoice.status === "overdue" || (invoice.status === "pending" && new Date(invoice.dueAt).getTime() < now)) {
        summary.overdue += amount;
      } else if (invoice.status === "pending") {
        summary.pending += amount;
      }
      return summary;
    },
    { total: 0, paid: 0, pending: 0, overdue: 0 },
  );
}

function createInvoiceFromQuote(quote, dueDays = 7) {
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt.getTime() + Number(dueDays || 7) * 24 * 60 * 60 * 1000);
  return {
    id: crypto.randomUUID(),
    invoiceNo: createInvoiceId(),
    publicToken: crypto.randomBytes(12).toString("hex"),
    quoteId: quote.id,
    quoteNo: quote.quoteNo,
    userId: quote.userId || "",
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    serviceName: quote.serviceName,
    planId: quote.planId || "",
    planName: quote.planName || "",
    amount: Number(quote.amount) || 0,
    currency: quote.currency || "HKD",
    status: "pending",
    notes: quote.notes || "",
    issuedAt: issuedAt.toISOString(),
    dueAt: dueAt.toISOString(),
    createdAt: issuedAt.toISOString(),
    updatedAt: issuedAt.toISOString(),
  };
}

async function currentUser(request, db) {
  const token = parseCookies(request).session;
  if (!token) {
    return null;
  }

  const session = db.sessions.find((item) => item.token === token && item.expiresAt > Date.now());
  if (!session) {
    return null;
  }

  return db.users.find((user) => user.id === session.userId) || null;
}

async function createSession(response, db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  db.sessions.push({
    token,
    userId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 24 * 14,
  });
  await saveDb(db);
  appendCookie(response, `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600`);
}

async function clearSession(request, response, db) {
  const token = parseCookies(request).session;
  db.sessions = db.sessions.filter((session) => session.token !== token);
  await saveDb(db);
  appendCookie(response, "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
}

async function createStripeCheckout(order, plan, request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  const origin = `http://${request.headers.host}`;
  const params = new URLSearchParams({
    mode: plan.interval === "month" ? "subscription" : "payment",
    success_url: `${origin}/dashboard.html?paid=pending`,
    cancel_url: `${origin}/pricing.html?cancelled=1`,
    client_reference_id: order.id,
    locale: "auto",
  });

  const priceId = process.env[`STRIPE_PRICE_${plan.id.replaceAll("-", "_").toUpperCase()}`];
  if (priceId) {
    params.append("line_items[0][price]", priceId);
    params.append("line_items[0][quantity]", "1");
  } else {
    params.append("line_items[0][price_data][currency]", "hkd");
    params.append("line_items[0][price_data][product_data][name]", plan.name);
    params.append("line_items[0][price_data][unit_amount]", String(plan.priceHkd * 100));
    params.append("line_items[0][quantity]", "1");
  }

  const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!stripeResponse.ok) {
    return null;
  }

  const checkout = await stripeResponse.json();
  return checkout.url;
}

async function exchangeGoogleCode(request, code) {
  const redirectUri = `${publicBaseUrl(request)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  if (!tokenResponse.ok) {
    return null;
  }

  return tokenResponse.json();
}

async function fetchGoogleProfile(accessToken) {
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileResponse.ok) {
    return null;
  }

  return profileResponse.json();
}

async function handleApi(request, response, url) {
  const db = await loadDb();
  const user = await currentUser(request, db);

  if (request.method === "GET" && url.pathname === "/api/me") {
    sendJson(response, 200, {
      user: publicUser(user),
      usage: user ? quotaStatus(db, { userId: user.id }, user.planId || "free-3-sku") : null,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/plans") {
    sendJson(response, 200, { plans, paymentMethods });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/usage") {
    const visitorId = normalizeVisitorId(url.searchParams.get("visitorId"));
    if (user) {
      sendJson(response, 200, {
        usage: quotaStatus(db, { userId: user.id }, user.planId || "free-3-sku"),
        user: publicUser(user),
      });
      return true;
    }
    if (!visitorId) {
      sendJson(response, 400, { error: "缺少访客 ID。" });
      return true;
    }
    sendJson(response, 200, {
      usage: quotaStatus(db, { visitorId }, "free-3-sku"),
      user: null,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/google") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      sendJson(response, 503, { error: "Google 登录还没有配置 Client ID 和 Secret。" });
      return true;
    }

    const state = crypto.randomBytes(16).toString("hex");
    const next = url.searchParams.get("next") || "/dashboard.html";
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: `${publicBaseUrl(request)}/api/auth/google/callback`,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "select_account",
    });

    appendCookie(response, `google_oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`);
    appendCookie(
      response,
      `google_oauth_next=${encodeURIComponent(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard.html")}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`,
    );
    redirect(response, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/auth/google/callback") {
    const cookies = parseCookies(request);
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    const next = cookies.google_oauth_next || "/dashboard.html";

    appendCookie(response, "google_oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    appendCookie(response, "google_oauth_next=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");

    if (!code || !state || state !== cookies.google_oauth_state) {
      redirect(response, `/login.html?error=${encodeURIComponent("Google 登录验证失败，请重新尝试。")}`);
      return true;
    }

    const token = await exchangeGoogleCode(request, code);
    const profile = token?.access_token ? await fetchGoogleProfile(token.access_token) : null;
    const email = String(profile?.email || "").trim().toLowerCase();

    if (!email || profile.email_verified === false) {
      redirect(response, `/login.html?error=${encodeURIComponent("Google 邮箱未验证，无法登录。")}`);
      return true;
    }

    let googleUser = db.users.find((item) => item.email === email);
    if (googleUser) {
      googleUser.provider = googleUser.provider === "email" ? "email+google" : googleUser.provider || "google";
      googleUser.googleSub = profile.sub || googleUser.googleSub || "";
      googleUser.name = googleUser.name || profile.name || email.split("@")[0];
      googleUser.updatedAt = new Date().toISOString();
    } else {
      googleUser = {
        id: crypto.randomUUID(),
        name: String(profile.name || email.split("@")[0]).trim(),
        email,
        provider: "google",
        googleSub: profile.sub || "",
        planId: "free-3-sku",
        onboarded: false,
        createdAt: new Date().toISOString(),
      };
      db.users.push(googleUser);
    }

    await createSession(response, db, googleUser.id);
    redirect(response, next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard.html");
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/stats") {
    sendJson(response, 200, {
      users: db.users.length,
      calculations: db.calculations.length,
      reports: db.leads.length,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname.match(/^\/api\/invoices\/public\/[^/]+$/)) {
    const publicToken = decodeURIComponent(url.pathname.split("/")[4] || "").trim();
    const invoice = db.invoices.find((item) => item.publicToken === publicToken);
    if (!invoice) {
      sendJson(response, 404, { error: "发票不存在或链接已失效。" });
      return true;
    }

    sendJson(response, 200, {
      invoice: publicInvoice(invoice),
      company: db.settings.company,
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim() || email.split("@")[0];

    if (!email.includes("@") || password.length < 6) {
      sendJson(response, 400, { error: "请输入有效邮箱，密码至少 6 位。" });
      return true;
    }

    if (db.users.some((item) => item.email === email)) {
      sendJson(response, 409, { error: "这个邮箱已经注册，可以直接登录。" });
      return true;
    }

    const newUser = {
      id: crypto.randomUUID(),
      name,
      email,
      provider: "email",
      passwordHash: hashPassword(password),
      planId: "free-3-sku",
      onboarded: false,
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    await createSession(response, db, newUser.id);
    sendJson(response, 201, { user: publicUser(newUser) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const matched = db.users.find((item) => item.email === email && item.passwordHash);

    if (!matched || !verifyPassword(password, matched.passwordHash)) {
      sendJson(response, 401, { error: "邮箱或密码不正确。" });
      return true;
    }

    await createSession(response, db, matched.id);
    sendJson(response, 200, { user: publicUser(matched) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/demo-social") {
    const body = await readBody(request);
    const provider = body.provider === "wechat" ? "wechat-demo" : "google-demo";
    const email = `${provider}-${crypto.randomBytes(3).toString("hex")}@demo.skuprofit.local`;
    const newUser = {
      id: crypto.randomUUID(),
      name: provider === "wechat-demo" ? "微信演示用户" : "Google 演示用户",
      email,
      provider,
      planId: "free-3-sku",
      onboarded: false,
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    await createSession(response, db, newUser.id);
    sendJson(response, 201, { user: publicUser(newUser), demo: true });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    await clearSession(request, response, db);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/account/password") {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    const body = await readBody(request);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");

    if (newPassword.length < 6) {
      sendJson(response, 400, { error: "新密码至少 6 位。" });
      return true;
    }

    if (user.passwordHash && !verifyPassword(currentPassword, user.passwordHash)) {
      sendJson(response, 401, { error: "当前密码不正确。" });
      return true;
    }

    user.passwordHash = hashPassword(newPassword);
    user.updatedAt = new Date().toISOString();
    await saveDb(db);
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/account/onboarding") {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    user.onboarded = true;
    user.updatedAt = new Date().toISOString();
    await saveDb(db);
    sendJson(response, 200, { user: publicUser(user) });
    return true;
  }

  if (request.method === "DELETE" && url.pathname === "/api/account") {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    const body = await readBody(request);
    if (body.confirm !== "DELETE") {
      sendJson(response, 400, { error: "请输入 DELETE 确认注销。" });
      return true;
    }

    db.users = db.users.filter((item) => item.id !== user.id);
    db.sessions = db.sessions.filter((item) => item.userId !== user.id);
    db.orders = db.orders.filter((item) => item.userId !== user.id);
    db.calculations = db.calculations.filter((item) => item.userId !== user.id);
    await saveDb(db);
    response.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/leads") {
    const body = await readBody(request);
    const lead = {
      id: crypto.randomUUID(),
      ...body,
      userId: user?.id || body.userId || "",
      reportId: createReportId(),
      status: "new",
      source: body.source || "homepage",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.leads.push(lead);
    await saveDb(db);
    sendJson(response, 201, { ok: true, lead });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/calculations") {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    let changed = false;
    db.calculations.forEach((item) => {
      if (!item.shareToken) {
        item.shareToken = crypto.randomBytes(12).toString("hex");
        changed = true;
      }
    });
    if (changed) {
      await saveDb(db);
    }

    sendJson(response, 200, {
      calculations: db.calculations
        .filter((item) => item.userId === user.id)
        .map(publicCalculation)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname.match(/^\/api\/calculations\/public\/[^/]+$/)) {
    const shareToken = decodeURIComponent(url.pathname.split("/")[4] || "").trim();
    const calculation = db.calculations.find((item) => item.shareToken === shareToken);
    if (!calculation) {
      sendJson(response, 404, { error: "分享记录不存在或链接已失效。" });
      return true;
    }

    sendJson(response, 200, { calculation: publicCalculation(calculation) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/audits") {
    const body = await readBody(request);
    const visitorId = normalizeVisitorId(body.visitorId);
    const identity = user ? { userId: user.id } : { visitorId };
    const planId = user?.planId || "free-3-sku";

    if (!user && !visitorId) {
      sendJson(response, 400, { error: "缺少访客 ID。" });
      return true;
    }

    const usage = quotaStatus(db, identity, planId);
    if (usage.remaining <= 0) {
      sendJson(response, 403, {
        error: user ? "本月套餐额度已用完，请升级套餐或下月继续。" : "免费额度已用完，请登录后继续生成利润体检。",
        usage,
        loginRequired: !user,
      });
      return true;
    }

    if (!user) {
      const fingerprint = requestFingerprint(request);
      let visitor = db.visitors.find((item) => item.visitorId === visitorId);
      if (!visitor) {
        visitor = {
          id: crypto.randomUUID(),
          visitorId,
          fingerprint,
          createdAt: new Date().toISOString(),
        };
        db.visitors.push(visitor);
      }
      visitor.fingerprint = fingerprint;
      visitor.lastSeenAt = new Date().toISOString();
    }

    const calculation = {
      id: crypto.randomUUID(),
      reportId: createSkuReportId(),
      userId: user?.id || "",
      visitorId: user ? "" : visitorId,
      shareToken: crypto.randomBytes(12).toString("hex"),
      sku: String(body.sku || "未命名 SKU").slice(0, 120),
      platform: String(body.platform || "-").slice(0, 80),
      inputs: body.inputs || {},
      result: body.result || {},
      risk: String(body.risk || "-").slice(0, 40),
      recommendations: Array.isArray(body.recommendations) ? body.recommendations.slice(0, 8) : [],
      driver: body.driver || {},
      source: user ? "logged-in-audit" : "anonymous-audit",
      usageMonth: usageMonth(),
      createdAt: new Date().toISOString(),
    };
    db.calculations.push(calculation);
    await saveDb(db);
    sendJson(response, 201, {
      calculation: publicCalculation(calculation),
      usage: quotaStatus(db, identity, planId),
      reportUrl: `/report.html?id=${encodeURIComponent(calculation.reportId)}`,
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/calculations") {
    if (!user) {
      sendJson(response, 401, { error: "请先登录后保存计算记录。" });
      return true;
    }

    const body = await readBody(request);
    const calculation = {
      id: crypto.randomUUID(),
      userId: user.id,
      reportId: createSkuReportId(),
      shareToken: crypto.randomBytes(12).toString("hex"),
      sku: String(body.sku || "未命名 SKU").slice(0, 120),
      platform: String(body.platform || "-").slice(0, 80),
      inputs: body.inputs || {},
      result: body.result || {},
      risk: String(body.risk || "-").slice(0, 40),
      recommendations: Array.isArray(body.recommendations) ? body.recommendations.slice(0, 8) : [],
      driver: body.driver || {},
      usageMonth: usageMonth(),
      createdAt: new Date().toISOString(),
    };
    db.calculations.push(calculation);
    await saveDb(db);
    sendJson(response, 201, { calculation });
    return true;
  }

  if (request.method === "GET" && url.pathname.match(/^\/api\/reports\/[^/]+$/)) {
    const reportId = decodeURIComponent(url.pathname.split("/")[3] || "").trim().toUpperCase();
    const calculationReport = db.calculations.find(
      (item) =>
        String(item.reportId || "").toUpperCase() === reportId ||
        String(item.id || "").toUpperCase() === reportId ||
        String(item.shareToken || "").toUpperCase() === reportId,
    );
    if (calculationReport) {
      sendJson(response, 200, {
        report: {
          type: "calculation",
          reportId: calculationReport.reportId || calculationReport.id,
          status: "delivered",
          calculation: publicCalculation(calculationReport),
          createdAt: calculationReport.createdAt,
        },
      });
      return true;
    }

    const lead = db.leads.find((item) => String(item.reportId || "").toUpperCase() === reportId);

    if (!lead) {
      sendJson(response, 404, { error: "报告不存在或编号不正确。" });
      return true;
    }

    const calculations = lead.userId
      ? db.calculations
          .filter((item) => item.userId === lead.userId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 50)
      : [];

    sendJson(response, 200, {
      report: {
        reportId: lead.reportId,
        status: lead.status || "new",
        name: lead.name || "",
        platform: lead.platform || "",
        skuCount: lead.skuCount || "",
        pain: lead.pain || "",
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt || lead.createdAt,
        calculations: calculations.map(publicCalculation),
        summary: reportSummaryFromCalculations(calculations),
      },
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/orders") {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    sendJson(response, 200, {
      orders: db.orders
        .filter((order) => order.userId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/billing") {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    const quotes = db.quotes
      .filter((item) => item.userId === user.id || item.customerEmail === user.email)
      .map(publicQuote)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const invoices = db.invoices
      .filter((item) => item.userId === user.id || item.customerEmail === user.email)
      .map(publicInvoice)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    sendJson(response, 200, { quotes, invoices, overview: billingOverview(invoices) });
    return true;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/quotes\/[^/]+\/accept$/)) {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    const quoteId = url.pathname.split("/")[3];
    const quote = db.quotes.find((item) => item.id === quoteId && (item.userId === user.id || item.customerEmail === user.email));
    if (!quote) {
      sendJson(response, 404, { error: "报价不存在。" });
      return true;
    }

    if (quote.invoiceId) {
      const invoice = db.invoices.find((item) => item.id === quote.invoiceId);
      sendJson(response, 200, { quote: publicQuote(quote), invoice: invoice ? publicInvoice(invoice) : null });
      return true;
    }

    const invoice = createInvoiceFromQuote({ ...quote, userId: user.id }, 7);
    quote.status = "converted";
    quote.userId = user.id;
    quote.invoiceId = invoice.id;
    quote.updatedAt = new Date().toISOString();
    db.invoices.push(invoice);
    await saveDb(db);
    sendJson(response, 201, { quote: publicQuote(quote), invoice: publicInvoice(invoice) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/orders") {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    const body = await readBody(request);
    const plan = plans.find((item) => item.id === body.planId);
    const method = paymentMethods.find((item) => item.id === body.paymentMethod);

    if (!plan || !method) {
      sendJson(response, 400, { error: "套餐或付款方式不存在。" });
      return true;
    }

    const order = {
      id: crypto.randomUUID(),
      userId: user.id,
      planId: plan.id,
      planName: plan.name,
      paymentMethod: method.id,
      amountCny: plan.priceCny,
      amountHkd: plan.priceHkd,
      status: plan.priceCny === 0 ? "paid" : "pending_payment",
      proofNote: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (plan.priceCny === 0) {
      user.planId = plan.id;
    }

    db.orders.push(order);
    await saveDb(db);

    if (method.id === "stripe-hk" && plan.priceHkd > 0) {
      const checkoutUrl = await createStripeCheckout(order, plan, request);
      if (checkoutUrl) {
        order.stripeCheckoutUrl = checkoutUrl;
        await saveDb(db);
        sendJson(response, 201, { order, checkoutUrl });
        return true;
      }
    }

    sendJson(response, 201, { order });
    return true;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/orders\/[^/]+\/proof$/)) {
    if (!user) {
      sendJson(response, 401, { error: "请先登录。" });
      return true;
    }

    const orderId = url.pathname.split("/")[3];
    const order = db.orders.find((item) => item.id === orderId && item.userId === user.id);
    if (!order) {
      sendJson(response, 404, { error: "订单不存在。" });
      return true;
    }

    const body = await readBody(request);
    order.proofNote = String(body.proofNote || "").trim();
    order.status = "reviewing";
    order.updatedAt = new Date().toISOString();
    await saveDb(db);
    sendJson(response, 200, { order });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/orders") {
    if (url.searchParams.get("code") !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    sendJson(response, 200, {
      orders: db.orders.map((order) => ({
        ...order,
        user: publicUser(db.users.find((item) => item.id === order.userId)),
      })),
      leads: db.leads,
    });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/admin/billing") {
    if (url.searchParams.get("code") !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    let changed = false;
    db.invoices.forEach((invoice) => {
      if (!invoice.publicToken) {
        invoice.publicToken = crypto.randomBytes(12).toString("hex");
        changed = true;
      }
    });
    if (changed) {
      await saveDb(db);
    }

    const invoices = db.invoices.map(publicInvoice);
    const adminUsers = db.users.map((item) => {
      const usage = quotaStatus(db, { userId: item.id }, item.planId || "free-3-sku");
      const recentReports = db.calculations
        .filter((calculation) => calculation.userId === item.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 3)
        .map((calculation) => ({
          reportId: calculation.reportId || calculation.id,
          sku: calculation.sku || "未命名 SKU",
          createdAt: calculation.createdAt,
        }));
      return {
        ...publicUser(item),
        usage,
        recentReports,
      };
    });
    sendJson(response, 200, {
      users: adminUsers,
      quotes: db.quotes.map(publicQuote).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      invoices: invoices.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      overview: billingOverview(invoices),
      company: db.settings.company,
    });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/settings/company") {
    const body = await readBody(request);
    if (body.code !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    db.settings.company = {
      ...db.settings.company,
      companyName: String(body.companyName || db.settings.company.companyName).trim(),
      legalName: String(body.legalName || db.settings.company.legalName).trim(),
      email: String(body.email || db.settings.company.email).trim(),
      address: String(body.address || db.settings.company.address).trim(),
      paymentInstructions: String(body.paymentInstructions || db.settings.company.paymentInstructions).trim(),
      logoDataUrl: String(body.logoDataUrl || "").startsWith("data:image/")
        ? String(body.logoDataUrl).slice(0, 400000)
        : db.settings.company.logoDataUrl,
    };
    await saveDb(db);
    sendJson(response, 200, { company: db.settings.company });
    return true;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/admin\/users\/[^/]+\/plan$/)) {
    const body = await readBody(request);
    if (body.code !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    const userId = url.pathname.split("/")[4];
    const targetUser = db.users.find((item) => item.id === userId);
    const plan = plans.find((item) => item.id === body.planId);
    if (!targetUser || !plan) {
      sendJson(response, 400, { error: "用户或套餐不存在。" });
      return true;
    }

    targetUser.planId = plan.id;
    targetUser.updatedAt = new Date().toISOString();
    await saveDb(db);
    sendJson(response, 200, { user: publicUser(targetUser) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/quotes") {
    const body = await readBody(request);
    if (body.code !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    const email = String(body.customerEmail || "").trim().toLowerCase();
    const amount = Number(body.amount) || 0;
    if (!email.includes("@") || amount <= 0) {
      sendJson(response, 400, { error: "请输入客户邮箱和有效金额。" });
      return true;
    }

    const matchedUser = db.users.find((item) => item.email === email);
    const selectedPlan = plans.find((item) => item.id === body.planId) || plans.find((item) => item.id === "audit-20-sku");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + Number(body.validDays || 7) * 24 * 60 * 60 * 1000);
    const quote = {
      id: crypto.randomUUID(),
      quoteNo: createQuoteId(),
      userId: matchedUser?.id || "",
      customerName: String(body.customerName || matchedUser?.name || email.split("@")[0]).trim(),
      customerEmail: email,
      serviceName: String(body.serviceName || "SKU 利润体检服务").trim(),
      planId: selectedPlan?.id || "",
      planName: selectedPlan?.name || "",
      amount,
      currency: String(body.currency || "HKD").trim().toUpperCase(),
      status: "sent",
      notes: String(body.notes || "").trim(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    db.quotes.push(quote);
    await saveDb(db);
    sendJson(response, 201, { quote: publicQuote(quote) });
    return true;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/admin\/quotes\/[^/]+\/convert$/)) {
    const body = await readBody(request);
    if (body.code !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    const quoteId = url.pathname.split("/")[4];
    const quote = db.quotes.find((item) => item.id === quoteId);
    if (!quote) {
      sendJson(response, 404, { error: "报价不存在。" });
      return true;
    }

    if (quote.invoiceId) {
      const existingInvoice = db.invoices.find((item) => item.id === quote.invoiceId);
      sendJson(response, 200, { quote: publicQuote(quote), invoice: existingInvoice ? publicInvoice(existingInvoice) : null });
      return true;
    }

    const invoice = createInvoiceFromQuote(quote, body.dueDays || 7);
    quote.status = "converted";
    quote.invoiceId = invoice.id;
    quote.updatedAt = new Date().toISOString();
    db.invoices.push(invoice);
    await saveDb(db);
    sendJson(response, 201, { quote: publicQuote(quote), invoice: publicInvoice(invoice) });
    return true;
  }

  if (request.method === "POST" && url.pathname.match(/^\/api\/admin\/invoices\/[^/]+\/status$/)) {
    const body = await readBody(request);
    if (body.code !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    const invoiceId = url.pathname.split("/")[4];
    const invoice = db.invoices.find((item) => item.id === invoiceId);
    const allowedStatuses = ["pending", "paid", "overdue", "cancelled"];
    if (!invoice || !allowedStatuses.includes(body.status)) {
      sendJson(response, 400, { error: "发票或状态不存在。" });
      return true;
    }

    invoice.status = body.status;
    invoice.updatedAt = new Date().toISOString();
    invoice.paidAt = body.status === "paid" ? new Date().toISOString() : "";
    if (body.status === "paid" && invoice.planId) {
      const invoiceUser = db.users.find(
        (item) => item.id === invoice.userId || item.email === String(invoice.customerEmail || "").toLowerCase(),
      );
      if (invoiceUser) {
        invoiceUser.planId = invoice.planId;
        invoiceUser.updatedAt = invoice.updatedAt;
        invoice.userId = invoiceUser.id;
        invoice.upgradedAt ||= invoice.updatedAt;
      }
    }
    await saveDb(db);
    sendJson(response, 200, { invoice: publicInvoice(invoice) });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/mark-paid") {
    const body = await readBody(request);
    if (body.code !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    const order = db.orders.find((item) => item.id === body.orderId);
    if (!order) {
      sendJson(response, 404, { error: "订单不存在。" });
      return true;
    }

    const orderUser = db.users.find((item) => item.id === order.userId);
    order.status = "paid";
    order.updatedAt = new Date().toISOString();
    if (orderUser) {
      orderUser.planId = order.planId;
    }
    await saveDb(db);
    sendJson(response, 200, { order });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/admin/leads/status") {
    const body = await readBody(request);
    if (body.code !== adminCode) {
      sendJson(response, 403, { error: "管理码不正确。" });
      return true;
    }

    const lead = db.leads.find((item) => item.id === body.leadId);
    const allowedStatuses = ["new", "reviewing", "ready", "delivered"];
    if (!lead || !allowedStatuses.includes(body.status)) {
      sendJson(response, 400, { error: "线索或状态不存在。" });
      return true;
    }

    lead.status = body.status;
    lead.updatedAt = new Date().toISOString();
    await saveDb(db);
    sendJson(response, 200, { lead });
    return true;
  }

  return false;
}

async function sendFile(response, pathname, status = 200) {
  const safePathname = pathname === "/" ? "/index.html" : pathname;
  const filePath = normalize(join(root, safePathname));
  const resolved = resolve(filePath);

  if (!resolved.startsWith(resolve(root))) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(resolved);
    response.writeHead(status, {
      "Content-Type": types[extname(resolved)] || "application/octet-stream",
    });
    response.end(body);
    return true;
  } catch {
    return false;
  }
}

async function serveStatic(response, pathname) {
  const ok = await sendFile(response, pathname, 200);
  if (!ok) {
    const sent = await sendFile(response, "/404.html", 404);
    if (!sent) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
    }
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(request, response, url);
      if (!handled) {
        sendJson(response, 404, { error: "API 不存在。" });
      }
      return;
    }

    if (url.pathname === "/language") {
      setLanguage(response, url.searchParams.get("lang"), url.searchParams.get("next") || "/");
      return;
    }

    if (url.pathname === "/") {
      const lang = preferredLanguage(request);
      redirect(response, lang === "zh" ? "/index.html" : "/en.html");
      return;
    }

    if (url.pathname === "/login") {
      const lang = preferredLanguage(request);
      redirect(response, lang === "zh" ? "/login.html" : "/login-en.html");
      return;
    }

    if (url.pathname === "/pricing.html") {
      redirect(response, "/dashboard.html#pricing");
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    if (request.url?.startsWith("/api/")) {
      sendJson(response, 500, { error: "服务器错误。" });
      return;
    }
    const sent = await sendFile(response, "/error.html", 500);
    if (!sent) {
      sendJson(response, 500, { error: "服务器错误。" });
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`SKUAuditPro full-stack app running at http://0.0.0.0:${port}`);
  console.log(`Admin page: http://127.0.0.1:${port}/admin.html, code: ${adminCode}`);
});


