import crypto from "node:crypto";
import { getDb } from "./database.js";

const LIMITS = {
  "auth:login": { window: 15 * 60 * 1000, max: 10 },
  "auth:register": { window: 60 * 60 * 1000, max: 5 },
  "auth:password": { window: 15 * 60 * 1000, max: 5 },
  "api:default": { window: 60 * 1000, max: 60 },
  "api:audit": { window: 60 * 1000, max: 30 },
  "api:lead": { window: 60 * 60 * 1000, max: 20 },
  "admin:default": { window: 5 * 60 * 1000, max: 100 },
};

const CLEANUP_INTERVAL = 5 * 60 * 1000;

export function getClientIp(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.socket?.remoteAddress || "127.0.0.1";
}

export function getRateLimitKey(request, category = "api:default") {
  const ip = getClientIp(request);
  const identifier = String(request.headers["x-session-token"] || ip);
  return `${category}:${crypto.createHash("sha256").update(identifier).digest("hex").slice(0, 16)}`;
}

export function checkRateLimit(key, category = "api:default") {
  const db = getDb();
  const limit = LIMITS[category] || LIMITS["api:default"];
  const now = Date.now();
  const windowStart = now - (now % limit.window);

  db.prepare(`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (?, ?, 1)
    ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1
  `).run(key, windowStart);

  const result = db.prepare(
    "SELECT count FROM rate_limits WHERE key = ? AND window_start = ?",
  ).get(key, windowStart);

  const current = result ? Number(result.count) : 0;
  const remaining = Math.max(0, limit.max - current);
  const resetAt = windowStart + limit.window;

  return {
    allowed: current <= limit.max,
    current,
    limit: limit.max,
    remaining,
    resetAt,
  };
}

export function cleanupRateLimits() {
  const db = getDb();
  const cutoff = Date.now() - 60 * 60 * 1000;
  db.prepare("DELETE FROM rate_limits WHERE window_start < ?").run(cutoff);
}

let cleanupTimer = null;

export function startRateLimitCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanupRateLimits, CLEANUP_INTERVAL);
  cleanupTimer.unref();
}

export function rateLimitMiddleware(request, response, category = "api:default") {
  const key = getRateLimitKey(request, category);
  const result = checkRateLimit(key, category);
  const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);

  if (!result.allowed) {
    response.writeHead(429, {
      "Content-Type": "application/json; charset=utf-8",
      "Retry-After": String(retryAfter),
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    });
    response.end(JSON.stringify({
      error: "Too many requests. Please try again later.",
      retryAfter,
    }));
    return false;
  }

  response.setHeader("X-RateLimit-Limit", String(result.limit));
  response.setHeader("X-RateLimit-Remaining", String(result.remaining));
  response.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
  return true;
}
