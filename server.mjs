import http from "node:http";
import crypto from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = process.cwd();
const dataDir = join(root, "data");
const dbPath = join(dataDir, "db.json");
const port = Number(process.env.PORT || 4173);
const adminCode = process.env.ADMIN_CODE || "skuprofit-admin";

const plans = [
  {
    id: "free-3-sku",
    name: "免费测 3 个 SKU",
    priceCny: 0,
    priceHkd: 0,
    interval: "once",
    features: ["3 个 SKU 利润体检", "风险等级", "保本售价", "初步优化建议"],
  },
  {
    id: "audit-20-sku",
    name: "20 SKU 利润体检",
    priceCny: 299,
    priceHkd: 328,
    interval: "once",
    popular: true,
    features: ["20 个 SKU 批量诊断", "隐藏亏损品清单", "达人佣金上限", "广告 CPA 上限"],
  },
  {
    id: "store-audit",
    name: "整店利润诊断",
    priceCny: 999,
    priceHkd: 1099,
    interval: "once",
    features: ["50-100 个 SKU", "定价建议", "物流/关税敏感性", "一次复盘沟通"],
  },
  {
    id: "pro-monthly",
    name: "Pro 月度监控",
    priceCny: 699,
    priceHkd: 769,
    interval: "month",
    features: ["SKU 利润看板", "每周风险提醒", "批量 CSV 导出", "政策/费用变动记录"],
  },
];

const paymentMethods = [
  {
    id: "manual-cn-bank",
    name: "国内银行卡转账",
    currency: "CNY",
    status: "ready",
    note: "适合早期人工收款。客户提交付款备注后，你在管理后台审核开通。",
  },
  {
    id: "manual-hk-bank",
    name: "香港银行卡 / FPS 转账",
    currency: "HKD",
    status: "ready",
    note: "适合香港账户收款。早期可用人工审核，后续再接 Stripe HK。",
  },
  {
    id: "stripe-hk",
    name: "Stripe HK：信用卡 / Alipay / WeChat Pay",
    currency: "HKD/USD",
    status: process.env.STRIPE_SECRET_KEY ? "configurable" : "needs_keys",
    note: "需要 Stripe 香港账户、密钥和 Price ID。代码已预留 Checkout 接口。",
  },
  {
    id: "manual-service",
    name: "人工对公/服务商代收",
    currency: "CNY/HKD",
    status: "ready",
    note: "适合先通过货代、海外仓、培训服务商分销，按订单返佣。",
  },
];

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
    await saveDb({ users: [], sessions: [], orders: [], leads: [] });
  }

  return JSON.parse(await readFile(dbPath, "utf-8"));
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
    createdAt: user.createdAt,
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
  response.setHeader("Set-Cookie", `session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=1209600`);
}

async function clearSession(request, response, db) {
  const token = parseCookies(request).session;
  db.sessions = db.sessions.filter((session) => session.token !== token);
  await saveDb(db);
  response.setHeader("Set-Cookie", "session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");
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

async function handleApi(request, response, url) {
  const db = await loadDb();
  const user = await currentUser(request, db);

  if (request.method === "GET" && url.pathname === "/api/me") {
    sendJson(response, 200, { user: publicUser(user) });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/api/plans") {
    sendJson(response, 200, { plans, paymentMethods });
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

  if (request.method === "POST" && url.pathname === "/api/leads") {
    const body = await readBody(request);
    db.leads.push({
      id: crypto.randomUUID(),
      ...body,
      createdAt: new Date().toISOString(),
    });
    await saveDb(db);
    sendJson(response, 201, { ok: true });
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

  return false;
}

async function serveStatic(response, pathname) {
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
    response.writeHead(200, {
      "Content-Type": types[extname(resolved)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
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
    sendJson(response, 500, { error: "服务器错误。" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`SKUProfit full-stack app running at http://0.0.0.0:${port}`);
  console.log(`Admin page: http://127.0.0.1:${port}/admin.html, code: ${adminCode}`);
});


