import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../lib/client-api.js";

test("only expired admin requests redirect to sign-in", async () => {
  const originalFetch = globalThis.fetch, originalWindow = globalThis.window;
  const redirects = [];
  globalThis.window = { location: { replace: path => redirects.push(path) } };
  try {
    globalThis.fetch = async () => Response.json({ error: "Session expired" }, { status: 401 });
    await assert.rejects(api("admin/dashboard"), { status: 401 });
    assert.deepEqual(redirects, ["/signin?reason=session-expired"]);
    redirects.length = 0;
    await assert.rejects(api("auth/password-login", {}), { status: 401 });
    assert.equal(redirects.length, 0);
    globalThis.fetch = async () => Response.json({ error: "Forbidden" }, { status: 403 });
    await assert.rejects(api("admin/dashboard"), { status: 403 });
    assert.equal(redirects.length, 0);
  } finally { globalThis.fetch = originalFetch; globalThis.window = originalWindow; }
});
