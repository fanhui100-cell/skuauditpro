import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = dirname(__dirname);
const dataDir = join(rootDir, "data");
const dbPath = join(dataDir, "skuaudit.db");
const jsonPath = join(dataDir, "db.json");

let db = null;

const emptyDb = (defaultCompanySettings = {}) => ({
  users: [],
  sessions: [],
  orders: [],
  leads: [],
  calculations: [],
  visitors: [],
  quotes: [],
  invoices: [],
  settings: { company: { ...defaultCompanySettings } },
});

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringify(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function cryptoRandomToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function normalizeDbShape(appDb, defaultCompanySettings = {}) {
  const normalized = { ...emptyDb(defaultCompanySettings), ...(appDb || {}) };
  normalized.users ||= [];
  normalized.sessions ||= [];
  normalized.orders ||= [];
  normalized.leads ||= [];
  normalized.calculations ||= [];
  normalized.visitors ||= [];
  normalized.quotes ||= [];
  normalized.invoices ||= [];
  normalized.settings ||= {};
  normalized.settings.company = {
    ...defaultCompanySettings,
    ...(normalized.settings.company || {}),
  };
  return normalized;
}

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb() {
  if (db) return db;

  if (!existsSync(dataDir)) {
    throw new Error("Database directory is not initialized. Call initDatabase() first.");
  }

  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

export async function initDatabase(defaultCompanySettings = {}) {
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
  }

  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL DEFAULT 'email',
      password_hash TEXT,
      google_sub TEXT,
      plan_id TEXT NOT NULL DEFAULT 'free-3-sku',
      email_verified INTEGER NOT NULL DEFAULT 0,
      email_verified_at TEXT,
      onboarded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      purpose TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      plan_name TEXT NOT NULL DEFAULT '',
      payment_method TEXT NOT NULL DEFAULT '',
      amount_cny REAL NOT NULL DEFAULT 0,
      amount_hkd REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending_payment',
      proof_note TEXT NOT NULL DEFAULT '',
      stripe_checkout_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      contact TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      sku_count TEXT NOT NULL DEFAULT '',
      pain TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'homepage',
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calculations (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      user_id TEXT NOT NULL DEFAULT '',
      visitor_id TEXT NOT NULL DEFAULT '',
      share_token TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT '',
      inputs TEXT NOT NULL DEFAULT '{}',
      result TEXT NOT NULL DEFAULT '{}',
      risk TEXT NOT NULL DEFAULT '',
      recommendations TEXT NOT NULL DEFAULT '[]',
      driver TEXT NOT NULL DEFAULT '{}',
      source TEXT NOT NULL DEFAULT 'anonymous-audit',
      usage_month TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL UNIQUE,
      fingerprint TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      quote_no TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      customer_email TEXT NOT NULL,
      service_name TEXT NOT NULL DEFAULT '',
      plan_id TEXT NOT NULL DEFAULT '',
      plan_name TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'HKD',
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT NOT NULL DEFAULT '',
      invoice_id TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      invoice_no TEXT NOT NULL UNIQUE,
      public_token TEXT NOT NULL UNIQUE,
      quote_id TEXT,
      quote_no TEXT NOT NULL DEFAULT '',
      user_id TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      customer_email TEXT NOT NULL DEFAULT '',
      service_name TEXT NOT NULL DEFAULT '',
      plan_id TEXT NOT NULL DEFAULT '',
      plan_name TEXT NOT NULL DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'HKD',
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      issued_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      paid_at TEXT,
      upgraded_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_code_hash TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      details TEXT NOT NULL DEFAULT '{}',
      ip_address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      key TEXT NOT NULL,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (key, window_start)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_user ON auth_tokens(user_id, purpose);
    CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires ON auth_tokens(expires_at);
    CREATE INDEX IF NOT EXISTS idx_calculations_user ON calculations(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_calculations_visitor ON calculations(visitor_id, usage_month);
    CREATE INDEX IF NOT EXISTS idx_calculations_share ON calculations(share_token);
    CREATE INDEX IF NOT EXISTS idx_calculations_report ON calculations(report_id);
    CREATE INDEX IF NOT EXISTS idx_calculations_month ON calculations(usage_month);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_public ON invoices(public_token);
    CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
    CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id);
    CREATE INDEX IF NOT EXISTS idx_leads_user ON leads(user_id);
  `);

  ensureColumn(db, "users", "email_verified", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "users", "email_verified_at", "TEXT");

  const settings = db.prepare("SELECT value FROM settings WHERE key = 'company'").get();
  if (!settings) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('company', ?)").run(
      stringify(defaultCompanySettings, {}),
    );
  }

  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export function loadAppDb(defaultCompanySettings = {}) {
  const db = getDb();
  const companyRow = db.prepare("SELECT value FROM settings WHERE key = 'company'").get();

  return normalizeDbShape(
    {
      users: db.prepare("SELECT * FROM users ORDER BY created_at ASC").all().map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        provider: row.provider,
        passwordHash: row.password_hash || "",
        googleSub: row.google_sub || "",
        planId: row.plan_id,
        emailVerified: Boolean(row.email_verified),
        emailVerifiedAt: row.email_verified_at || "",
        onboarded: Boolean(row.onboarded),
        createdAt: row.created_at,
        updatedAt: row.updated_at || "",
      })),
      sessions: db.prepare("SELECT * FROM sessions").all().map((row) => ({
        token: row.token,
        userId: row.user_id,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
      })),
      orders: db.prepare("SELECT * FROM orders ORDER BY created_at ASC").all().map((row) => ({
        id: row.id,
        userId: row.user_id,
        planId: row.plan_id,
        planName: row.plan_name,
        paymentMethod: row.payment_method,
        amountCny: row.amount_cny,
        amountHkd: row.amount_hkd,
        status: row.status,
        proofNote: row.proof_note,
        stripeCheckoutUrl: row.stripe_checkout_url || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      leads: db.prepare("SELECT * FROM leads ORDER BY created_at ASC").all().map((row) => ({
        id: row.id,
        reportId: row.report_id,
        userId: row.user_id,
        name: row.name,
        contact: row.contact,
        platform: row.platform,
        skuCount: row.sku_count,
        pain: row.pain,
        source: row.source,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      calculations: db.prepare("SELECT * FROM calculations ORDER BY created_at ASC").all().map((row) => ({
        id: row.id,
        reportId: row.report_id,
        userId: row.user_id,
        visitorId: row.visitor_id,
        shareToken: row.share_token,
        sku: row.sku,
        platform: row.platform,
        inputs: parseJson(row.inputs, {}),
        result: parseJson(row.result, {}),
        risk: row.risk,
        recommendations: parseJson(row.recommendations, []),
        driver: parseJson(row.driver, {}),
        source: row.source,
        usageMonth: row.usage_month,
        createdAt: row.created_at,
      })),
      visitors: db.prepare("SELECT * FROM visitors ORDER BY created_at ASC").all().map((row) => ({
        id: row.id,
        visitorId: row.visitor_id,
        fingerprint: row.fingerprint,
        createdAt: row.created_at,
        lastSeenAt: row.last_seen_at,
      })),
      quotes: db.prepare("SELECT * FROM quotes ORDER BY created_at ASC").all().map((row) => ({
        id: row.id,
        quoteNo: row.quote_no,
        userId: row.user_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        serviceName: row.service_name,
        planId: row.plan_id,
        planName: row.plan_name,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        notes: row.notes,
        invoiceId: row.invoice_id || "",
        expiresAt: row.expires_at || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      invoices: db.prepare("SELECT * FROM invoices ORDER BY created_at ASC").all().map((row) => ({
        id: row.id,
        invoiceNo: row.invoice_no,
        publicToken: row.public_token,
        quoteId: row.quote_id || "",
        quoteNo: row.quote_no,
        userId: row.user_id,
        customerName: row.customer_name,
        customerEmail: row.customer_email,
        serviceName: row.service_name,
        planId: row.plan_id,
        planName: row.plan_name,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        notes: row.notes,
        issuedAt: row.issued_at,
        dueAt: row.due_at,
        paidAt: row.paid_at || "",
        upgradedAt: row.upgraded_at || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
      settings: {
        company: parseJson(companyRow?.value, defaultCompanySettings),
      },
    },
    defaultCompanySettings,
  );
}

export function saveAppDb(appDb, defaultCompanySettings = {}) {
  const nextDb = normalizeDbShape(appDb, defaultCompanySettings);
  const db = getDb();

  const save = () => {
    db.exec("BEGIN IMMEDIATE");
    try {
    db.exec(`
      DELETE FROM sessions;
      DELETE FROM orders;
      DELETE FROM leads;
      DELETE FROM calculations;
      DELETE FROM visitors;
      DELETE FROM quotes;
      DELETE FROM invoices;
      DELETE FROM users;
    `);

    const now = () => new Date().toISOString();

    const insertUser = db.prepare(`
      INSERT INTO users (id, name, email, provider, password_hash, google_sub, plan_id, email_verified, email_verified_at, onboarded, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of nextDb.users) {
      insertUser.run(
        user.id,
        user.name || "",
        user.email,
        user.provider || "email",
        user.passwordHash || null,
        user.googleSub || null,
        user.planId || "free-3-sku",
        user.emailVerified ? 1 : 0,
        user.emailVerifiedAt || null,
        user.onboarded ? 1 : 0,
        user.createdAt || now(),
        user.updatedAt || null,
      );
    }

    const insertSession = db.prepare("INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)");
    for (const session of nextDb.sessions) {
      insertSession.run(session.token, session.userId, session.createdAt, session.expiresAt);
    }

    const insertOrder = db.prepare(`
      INSERT INTO orders (id, user_id, plan_id, plan_name, payment_method, amount_cny, amount_hkd, status, proof_note, stripe_checkout_url, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const order of nextDb.orders) {
      insertOrder.run(
        order.id,
        order.userId,
        order.planId,
        order.planName || "",
        order.paymentMethod || "",
        Number(order.amountCny) || 0,
        Number(order.amountHkd) || 0,
        order.status || "pending_payment",
        order.proofNote || "",
        order.stripeCheckoutUrl || null,
        order.createdAt || now(),
        order.updatedAt || now(),
      );
    }

    const insertLead = db.prepare(`
      INSERT INTO leads (id, report_id, user_id, name, contact, platform, sku_count, pain, source, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const lead of nextDb.leads) {
      insertLead.run(
        lead.id,
        lead.reportId,
        lead.userId || "",
        lead.name || "",
        lead.contact || "",
        lead.platform || "",
        lead.skuCount || "",
        lead.pain || "",
        lead.source || "homepage",
        lead.status || "new",
        lead.createdAt || now(),
        lead.updatedAt || lead.createdAt || now(),
      );
    }

    const insertCalculation = db.prepare(`
      INSERT INTO calculations (id, report_id, user_id, visitor_id, share_token, sku, platform, inputs, result, risk, recommendations, driver, source, usage_month, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const calculation of nextDb.calculations) {
      insertCalculation.run(
        calculation.id,
        calculation.reportId || "",
        calculation.userId || "",
        calculation.visitorId || "",
        calculation.shareToken || "",
        calculation.sku || "",
        calculation.platform || "",
        stringify(calculation.inputs, {}),
        stringify(calculation.result, {}),
        calculation.risk || "",
        stringify(calculation.recommendations, []),
        stringify(calculation.driver, {}),
        calculation.source || "anonymous-audit",
        calculation.usageMonth || String(calculation.createdAt || "").slice(0, 7),
        calculation.createdAt || now(),
      );
    }

    const insertVisitor = db.prepare(`
      INSERT INTO visitors (id, visitor_id, fingerprint, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const visitor of nextDb.visitors) {
      insertVisitor.run(
        visitor.id,
        visitor.visitorId,
        visitor.fingerprint || "",
        visitor.createdAt || now(),
        visitor.lastSeenAt || visitor.createdAt || now(),
      );
    }

    const insertQuote = db.prepare(`
      INSERT INTO quotes (id, quote_no, user_id, customer_name, customer_email, service_name, plan_id, plan_name, amount, currency, status, notes, invoice_id, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const quote of nextDb.quotes) {
      insertQuote.run(
        quote.id,
        quote.quoteNo,
        quote.userId || "",
        quote.customerName || "",
        quote.customerEmail || "",
        quote.serviceName || "",
        quote.planId || "",
        quote.planName || "",
        Number(quote.amount) || 0,
        quote.currency || "HKD",
        quote.status || "draft",
        quote.notes || "",
        quote.invoiceId || null,
        quote.expiresAt || null,
        quote.createdAt || now(),
        quote.updatedAt || now(),
      );
    }

    const insertInvoice = db.prepare(`
      INSERT INTO invoices (id, invoice_no, public_token, quote_id, quote_no, user_id, customer_name, customer_email, service_name, plan_id, plan_name, amount, currency, status, notes, issued_at, due_at, paid_at, upgraded_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const invoice of nextDb.invoices) {
      insertInvoice.run(
        invoice.id,
        invoice.invoiceNo,
        invoice.publicToken || "",
        invoice.quoteId || null,
        invoice.quoteNo || "",
        invoice.userId || "",
        invoice.customerName || "",
        invoice.customerEmail || "",
        invoice.serviceName || "",
        invoice.planId || "",
        invoice.planName || "",
        Number(invoice.amount) || 0,
        invoice.currency || "HKD",
        invoice.status || "pending",
        invoice.notes || "",
        invoice.issuedAt || now(),
        invoice.dueAt || now(),
        invoice.paidAt || null,
        invoice.upgradedAt || null,
        invoice.createdAt || now(),
        invoice.updatedAt || now(),
      );
    }

    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('company', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(stringify(nextDb.settings.company, defaultCompanySettings));
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  };

  save();
}

export function appendAdminAuditLog({ adminCodeHash, action, targetType = "", targetId = "", details = {}, ipAddress = "" }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO admin_audit_log (admin_code_hash, action, target_type, target_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    adminCodeHash,
    action,
    targetType,
    targetId,
    stringify(details, {}),
    ipAddress,
    new Date().toISOString(),
  );
}

export function createAuthToken(userId, purpose, ttlMs = 60 * 60 * 1000) {
  const db = getDb();
  const token = cryptoRandomToken();
  const tokenHash = hashToken(token);
  const now = Date.now();

  db.prepare("DELETE FROM auth_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL").run(userId, purpose);
  db.prepare(`
    INSERT INTO auth_tokens (token_hash, user_id, purpose, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(tokenHash, userId, purpose, now, now + ttlMs);

  return token;
}

export function consumeAuthToken(token, purpose) {
  const db = getDb();
  const tokenHash = hashToken(token);
  const row = db.prepare(`
    SELECT token_hash, user_id, purpose, expires_at, used_at
    FROM auth_tokens
    WHERE token_hash = ? AND purpose = ?
  `).get(tokenHash, purpose);

  if (!row || row.used_at || Number(row.expires_at) < Date.now()) {
    return null;
  }

  db.prepare("UPDATE auth_tokens SET used_at = ? WHERE token_hash = ?").run(Date.now(), tokenHash);
  return { userId: row.user_id };
}

export function cleanupAuthTokens() {
  const db = getDb();
  db.prepare("DELETE FROM auth_tokens WHERE expires_at < ? OR used_at IS NOT NULL").run(Date.now() - 24 * 60 * 60 * 1000);
}

export function listAdminAuditLog(limit = 100) {
  const db = getDb();
  return db.prepare(`
    SELECT id, admin_code_hash, action, target_type, target_id, details, ip_address, created_at
    FROM admin_audit_log
    ORDER BY id DESC
    LIMIT ?
  `).all(Math.min(Math.max(Number(limit) || 100, 1), 500)).map((row) => ({
    id: row.id,
    adminCodeHash: row.admin_code_hash,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    details: parseJson(row.details, {}),
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  }));
}

export async function migrateFromJson(defaultCompanySettings = {}) {
  await initDatabase(defaultCompanySettings);

  if (!existsSync(jsonPath)) {
    return false;
  }

  const sqliteDb = getDb();
  const existingRows = sqliteDb.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM calculations) AS calculations,
      (SELECT COUNT(*) FROM orders) AS orders,
      (SELECT COUNT(*) FROM leads) AS leads,
      (SELECT COUNT(*) FROM quotes) AS quotes,
      (SELECT COUNT(*) FROM invoices) AS invoices
  `).get();

  const hasData = Object.values(existingRows).some((count) => Number(count) > 0);
  if (hasData) {
    return false;
  }

  const oldDb = normalizeDbShape(JSON.parse(await readFile(jsonPath, "utf-8")), defaultCompanySettings);
  saveAppDb(oldDb, defaultCompanySettings);
  return true;
}

export function databaseInfo() {
  return { dataDir, dbPath, jsonPath };
}
