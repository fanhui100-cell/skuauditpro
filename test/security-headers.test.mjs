import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { test } from "node:test";

function startServer(port) {
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      ADMIN_CODE: "test-admin-code",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  return child;
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early with code ${child.exitCode}`);
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/plans`);
      if (response.ok) return response;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("server did not start in time");
}

test("API responses include security and rate-limit headers", async () => {
  const port = 4197;
  const child = startServer(port);

  try {
    await waitForServer(port, child);
    const response = await fetch(`http://127.0.0.1:${port}/api/plans`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("x-ratelimit-limit"), "60");
  } finally {
    child.kill();
    await once(child, "exit").catch(() => {});
  }
});
