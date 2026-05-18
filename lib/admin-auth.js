import crypto from "node:crypto";

const DEFAULT_ADMIN_CODE = "skuprofit-admin";

function normalizeAdminRecord(record, index = 0) {
  const id = String(record.id || record.email || record.name || `admin-${index + 1}`).trim();
  const name = String(record.name || record.email || id).trim();
  const code = String(record.code || record.password || "").trim();
  const codeHash = String(record.codeHash || record.hash || "").trim();

  if (!code && !codeHash) {
    return null;
  }

  return {
    id,
    name,
    codeHash: codeHash || hashAdminCode(code),
  };
}

export function hashAdminCode(code) {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

export function resolveAdminUsers(env = process.env) {
  const rawUsers = String(env.ADMIN_USERS || "").trim();
  if (rawUsers) {
    try {
      const parsed = JSON.parse(rawUsers);
      const records = Array.isArray(parsed) ? parsed : [parsed];
      const users = records.map(normalizeAdminRecord).filter(Boolean);
      if (users.length) {
        return users;
      }
    } catch {
      // Fall back to ADMIN_CODES/ADMIN_CODE below so a bad JSON value does not brick local admin access.
    }
  }

  const rawCodes = String(env.ADMIN_CODES || env.ADMIN_CODE || DEFAULT_ADMIN_CODE)
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean);

  return rawCodes.map((code, index) => ({
    id: index === 0 ? "primary-admin" : `admin-${index + 1}`,
    name: index === 0 ? "Primary admin" : `Admin ${index + 1}`,
    codeHash: hashAdminCode(code),
  }));
}

export function verifyAdminCode(code, adminUsers = resolveAdminUsers()) {
  const incomingHash = hashAdminCode(String(code || "").trim());
  return adminUsers.find((admin) => {
    const expected = Buffer.from(admin.codeHash, "hex");
    const incoming = Buffer.from(incomingHash, "hex");
    return expected.length === incoming.length && crypto.timingSafeEqual(expected, incoming);
  }) || null;
}

export function isDefaultAdminConfig(env = process.env) {
  return !env.ADMIN_USERS && !env.ADMIN_CODES && !env.ADMIN_CODE;
}
