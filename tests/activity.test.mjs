import test, { mock } from "node:test";
import assert from "node:assert/strict";
let owner;
mock.module("../lib/supabase.js", {
  namedExports: {
    checked: async (value) => value,
    backend: () => ({
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => owner }) }),
      }),
    }),
  },
});
const { owns, connection } = await import("../lib/activity.js");
test("only the linked verified account can use guest definitions", async () => {
  owner = { kind: "guest", linked_to: "member-a", blocked: false };
  assert.equal(await owns({ sk: "member-a", kind: "member" }, "guest-a"), true);
  assert.equal(
    await owns({ sk: "member-b", kind: "member" }, "guest-a"),
    false,
  );
  assert.equal(await owns({ sk: "member-a", kind: "guest" }, "guest-a"), false);
  owner.blocked = true;
  assert.equal(
    await owns({ sk: "member-a", kind: "member" }, "guest-a"),
    false,
  );
  owner = null;
  assert.equal(
    await owns({ sk: "member-a", kind: "member" }, "missing"),
    false,
  );
});
test("local callers cannot supply a forged IP; Vercel IPs are validated", () => {
  process.env.IP_HASH_SECRET = "test-only-not-a-production-secret";
  delete process.env.VERCEL;
  const req = new Request("https://example.invalid", {
    headers: { "x-forwarded-for": "192.0.2.10", "x-vercel-ip-country": "FAKE" },
  });
  assert.equal(connection(req).ip, "127.0.0.1");
  assert.equal(connection(req).location.country, "Local");
  process.env.VERCEL = "1";
  assert.equal(connection(req).ip, "192.0.2.10");
  assert.equal(connection(req).hash.length, 64);
  assert.equal(
    connection(
      new Request("https://example.invalid", {
        headers: { "x-forwarded-for": "invalid" },
      }),
    ).ip,
    null,
  );
  delete process.env.VERCEL;
});
