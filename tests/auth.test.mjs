import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { EncryptJWT } from "jose";
import { createHash } from "node:crypto";
process.env.SESSION_SECRET = "test-only-secret-not-for-deployment";
process.env.APP_URL = "https://modolouge.example";
let cookieValue, record;
mock.module("next/headers.js", {
  namedExports: {
    cookies: async () => ({
      get: () => (cookieValue ? { value: cookieValue } : undefined),
    }),
  },
});
mock.module("../lib/aws.js", {
  namedExports: { get: async () => record, update: async () => {} },
});
const { requireUser, originCheck } = await import("../lib/auth.js");
async function cookie(sub, expiry = "1h") {
  cookieValue = await new EncryptJWT({ sub })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .encrypt(createHash("sha256").update(process.env.SESSION_SECRET).digest());
}
test("anonymous and tampered sessions cannot run jobs", async () => {
  cookieValue = null;
  await assert.rejects(requireUser(), { status: 401 });
  cookieValue = "forged-session";
  await assert.rejects(requireUser(), { status: 401 });
});
test("expired encrypted sessions are rejected", async () => {
  await cookie("test-user", Math.floor(Date.now() / 1000) - 60);
  await assert.rejects(requireUser(), { status: 401 });
});
test("account blocking applies to an existing valid session", async () => {
  await cookie("test-user");
  record = {
    sk: "test-user",
    email: "verified@example.invalid",
    blocked: true,
  };
  await assert.rejects(requireUser(), { status: 403 });
});
test("a regular verified account cannot access manager functions", async () => {
  await cookie("test-user");
  record = {
    sk: "test-user",
    email: "verified@example.invalid",
    blocked: false,
  };
  await assert.rejects(requireUser(true), { status: 403 });
  assert.equal((await requireUser()).sk, "test-user");
});
test("only the designated administrator can access manager functions", async () => {
  await cookie("admin");
  record = { sk: "admin", email: "info@toolworkslab.com", blocked: false };
  assert.equal((await requireUser(true)).email, "info@toolworkslab.com");
});
test("mutations reject foreign and absent Origin headers", () => {
  for (const origin of [
    null,
    "https://evil.invalid",
    "https://modolouge.example.evil.invalid",
  ])
    assert.throws(
      () =>
        originCheck(
          new Request("https://modolouge.example/api/jobs", {
            method: "POST",
            headers: origin ? { origin } : {},
          }),
        ),
      { status: 403 },
    );
  assert.doesNotThrow(() =>
    originCheck(
      new Request("https://modolouge.example/api/jobs", {
        method: "POST",
        headers: { origin: "https://modolouge.example" },
      }),
    ),
  );
});
