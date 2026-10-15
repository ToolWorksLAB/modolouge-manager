import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { EncryptJWT } from "jose";
import { createHash } from "node:crypto";
process.env.SESSION_SECRET = "test-only-secret-not-for-deployment";
process.env.APP_URL = "https://modolouge.example";
let cookieValue, record, authUser;
let expiredAccess = false;
const writes = [], deferred = [];
mock.module("next/server.js", { namedExports: { after: callback => deferred.push(callback) } });
mock.module("next/headers.js", {
  namedExports: {
    cookies: async () => ({
      get: () => (cookieValue ? { value: cookieValue } : undefined),
      set: (name, value, options) => writes.push({ name, value, options }),
    }),
  },
});
mock.module("../lib/aws.js", { namedExports: { update: async () => {} } });
mock.module("../lib/activity.js", {
  namedExports: {
    person: async () => record,
    activity: async () => {},
    connection: () => ({}),
    rateLimit: async () => true,
  },
});
mock.module("../lib/supabase.js", {
  namedExports: {
    authClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: authUser } }),
        refreshSession: async () => ({ error: new Error("Expired refresh token"), data: {} }),
      },
    }),
    backend: () => ({}),
    checked: async () => {},
  },
});
const { requireUser, originCheck, logout } = await import("../lib/auth.js");
async function cookie(sub, expiry = "1h") {
  cookieValue = await new EncryptJWT({
    sub,
    access: "test-access",
    expires: Math.floor(Date.now() / 1000) + (expiredAccess ? -60 : 3600),
  })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .encrypt(createHash("sha256").update(process.env.SESSION_SECRET).digest());
  authUser = {
    id: sub,
    email: "verified@example.invalid",
    email_confirmed_at: new Date().toISOString(),
    is_anonymous: false,
  };
}
test("missing, forged and expired sessions are rejected", async () => {
  cookieValue = null;
  await assert.rejects(requireUser(), { status: 401 });
  cookieValue = "forged";
  await assert.rejects(requireUser(), { status: 401 });
  await cookie("test", Math.floor(Date.now() / 1000) - 60);
  await assert.rejects(requireUser(), { status: 401 });
});
test("unverified and anonymous Supabase users cannot become members", async () => {
  await cookie("test");
  record = { id: "test", blocked: false };
  authUser.email_confirmed_at = null;
  await assert.rejects(requireUser(), { status: 401 });
  authUser.email_confirmed_at = new Date().toISOString();
  authUser.is_anonymous = true;
  await assert.rejects(requireUser(), { status: 401 });
});
test("blocking is checked against current database state", async () => {
  await cookie("test");
  record = { id: "test", blocked: true };
  await assert.rejects(requireUser(), { status: 403 });
});
test("profile email and editable user metadata cannot grant administration", async () => {
  await cookie("test");
  record = { id: "test", email: "info@toolworkslab.com", blocked: false };
  authUser.user_metadata = { role: "admin", email: "info@toolworkslab.com" };
  await assert.rejects(requireUser(true), { status: 403 });
  assert.equal((await requireUser()).email, "verified@example.invalid");
});
test("only a currently verified administrator email grants administration", async () => {
  await cookie("admin");
  authUser.email = "info@toolworkslab.com";
  record = { id: "admin", blocked: false };
  assert.equal((await requireUser(true)).email, "info@toolworkslab.com");
});
test("mutations reject absent, foreign and lookalike origins", () => {
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

test("an expired provider session expires the secure host cookie", async () => {
  expiredAccess = true;
  await cookie("admin");
  writes.length = 0;
  try { await assert.rejects(requireUser(true), { status: 401 }); }
  finally { expiredAccess = false; }
  assert.equal(writes.length, 1);
  assert.equal(writes[0].name, "__Host-modolouge-manager-v2");
  assert.equal(writes[0].value, "");
  assert.deepEqual(writes[0].options, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0, expires: new Date(0) });
});

test("logout clears session and recovery cookies before provider revocation", async () => {
  await cookie("admin");
  writes.length = 0; deferred.length = 0;
  const response = await logout(new Request("https://modolouge.example/api/auth/logout", {
    method: "POST", headers: { origin: "https://modolouge.example" },
  }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://modolouge.example/signin");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(writes.map(x => x.name), ["__Host-modolouge-manager-v2", "__Host-modolouge-manager-v2-flow", "__Host-modolouge-manager-v2-recovery"]);
  for (const w of writes) {
    assert.equal(w.value, ""); assert.equal(w.options.secure, true);
    assert.equal(w.options.path, "/"); assert.equal(w.options.maxAge, 0);
    assert.equal(w.options.domain, undefined);
  }
  assert.equal(deferred.length, 1);
  // The mocked provider is unavailable; failure must not undo local logout.
  await assert.doesNotReject(deferred[0]);
});

test("logout remains available with a malformed or missing session and rejects foreign origins", async () => {
  for (const value of [undefined, "invalid-cookie"]) {
    cookieValue = value; writes.length = 0;
    const response = await logout(new Request("https://modolouge.example/api/auth/logout", {
      method: "POST", headers: { origin: "https://modolouge.example" },
    }));
    assert.equal(response.status, 303); assert.equal(writes.length, 3);
  }
  writes.length = 0;
  await assert.rejects(logout(new Request("https://modolouge.example/api/auth/logout", {
    method: "POST", headers: { origin: "https://evil.invalid" },
  })), { status: 403 });
  assert.equal(writes.length, 0);
});
