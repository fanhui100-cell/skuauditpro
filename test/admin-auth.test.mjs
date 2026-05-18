import assert from "node:assert/strict";
import { test } from "node:test";
import { hashAdminCode, isDefaultAdminConfig, resolveAdminUsers, verifyAdminCode } from "../lib/admin-auth.js";

test("resolves legacy ADMIN_CODE as a single admin credential", () => {
  const admins = resolveAdminUsers({ ADMIN_CODE: "secret-one" });

  assert.equal(admins.length, 1);
  assert.equal(admins[0].id, "primary-admin");
  assert.ok(verifyAdminCode("secret-one", admins));
  assert.equal(verifyAdminCode("wrong", admins), null);
});

test("resolves multiple comma-separated admin codes", () => {
  const admins = resolveAdminUsers({ ADMIN_CODES: "alpha,beta" });

  assert.equal(admins.length, 2);
  assert.equal(verifyAdminCode("alpha", admins)?.id, "primary-admin");
  assert.equal(verifyAdminCode("beta", admins)?.id, "admin-2");
});

test("resolves ADMIN_USERS JSON with pre-hashed codes", () => {
  const admins = resolveAdminUsers({
    ADMIN_USERS: JSON.stringify([
      { id: "ops", name: "Ops", codeHash: hashAdminCode("ops-secret") },
      { id: "finance", name: "Finance", code: "finance-secret" },
    ]),
  });

  assert.equal(admins.length, 2);
  assert.equal(verifyAdminCode("ops-secret", admins)?.id, "ops");
  assert.equal(verifyAdminCode("finance-secret", admins)?.id, "finance");
});

test("detects default admin configuration", () => {
  assert.equal(isDefaultAdminConfig({}), true);
  assert.equal(isDefaultAdminConfig({ ADMIN_CODES: "alpha,beta" }), false);
});
