import { cookies } from "next/headers.js";
import { EncryptJWT, jwtDecrypt } from "jose";
import { randomUUID, createHash, createHmac } from "node:crypto";
import { update } from "./aws.js";
import { manager } from "./config.js";
import { authClient, backend, checked } from "./supabase.js";
import { activity, connection, rateLimit, person } from "./activity.js";
export const adminEmail = "info@toolworkslab.com";
const secure = () => !process.env.APP_URL?.startsWith("http://localhost");
const cookieName = () =>
  `${secure() ? "__Host-" : ""}modolouge${manager ? "-manager" : ""}-v2`;
const guestName = () => `${secure() ? "__Host-" : ""}modolouge-guest`;
const options = () => ({
  httpOnly: true,
  secure: secure(),
  sameSite: "lax",
  path: "/",
});
const key = () => {
  if (!process.env.SESSION_SECRET)
    throw new Error("Sign-in configuration is incomplete.");
  return createHash("sha256").update(process.env.SESSION_SECRET).digest();
};
const seal = (data, seconds) =>
  new EncryptJWT(data)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + seconds)
    .encrypt(key());
async function read(name) {
  const value = (await cookies()).get(name)?.value;
  if (!value) return null;
  try {
    return (await jwtDecrypt(value, key())).payload;
  } catch {
    return null;
  }
}
export function failure(message, status = 400, code) {
  return Object.assign(new Error(message), { status, code });
}
export function originCheck(req) {
  if (req.headers.get("origin") !== new URL(process.env.APP_URL).origin)
    throw failure("This request must originate from this application.", 403);
}
export const session = () => read(cookieName());
async function saveSession(s) {
  (await cookies()).set(
    cookieName(),
    await seal(
      {
        sub: s.user.id,
        email: s.user.email,
        access: s.access_token,
        refresh: s.refresh_token,
        expires: s.expires_at,
      },
      2592000,
    ),
    { ...options(), maxAge: 2592000 },
  );
}
export async function requireUser(admin = false) {
  let s = await session();
  if (!s?.access) throw failure("Sign in to continue.", 401);
  const client = authClient();
  if (s.expires < Date.now() / 1000 + 45) {
    const refreshed = await client.auth.refreshSession({
      refresh_token: s.refresh,
    });
    if (refreshed.error || !refreshed.data.session)
      throw failure("Your session expired. Sign in again.", 401);
    await saveSession(refreshed.data.session);
    s = { ...s, access: refreshed.data.session.access_token };
  }
  const { data, error } = await client.auth.getUser(s.access);
  if (error || !data.user?.email_confirmed_at || data.user.is_anonymous)
    throw failure("A verified email address is required.", 401);
  const u = await person(data.user.id);
  if (!u || u.blocked) throw failure("This account is disabled.", 403);
  // Authorization uses current verified Auth email, never user_metadata.
  if (admin && data.user.email?.toLowerCase() !== adminEmail)
    throw failure("Administrator access required.", 403);
  return { ...u, sk: u.id, email: data.user.email.toLowerCase() };
}
export async function requireActor() {
  if (await session()) return requireUser();
  const guest = await read(guestName());
  if (!guest?.id) throw failure("Start your free trial to continue.", 401);
  const u = await person(guest.id);
  if (!u || u.kind !== "guest" || u.linked_to)
    throw failure("Sign in to continue.", 401);
  if (u.blocked) throw failure("This visitor has been blocked.", 403);
  return { ...u, sk: u.id, email: `Guest ${u.id.slice(0, 8)}` };
}
export async function startTrial(req) {
  originCheck(req);
  if (manager) throw failure("Not found.", 404);
  if (await session()) return requireUser();
  const old = await read(guestName());
  if (old?.id) {
    const found = await person(old.id);
    if (found?.blocked) throw failure("This visitor has been blocked.", 403);
    if (found?.kind === "guest" && !found.linked_to)
      return { ...found, sk: found.id, email: `Guest ${found.id.slice(0, 8)}` };
    if (found?.linked_to)
      throw failure(
        "Your exploration is connected to an account. Sign in to continue.",
        401,
      );
  }
  const c = connection(req);
  if (!c.ip)
    throw failure(
      "Could not establish a secure trial connection. Please sign in.",
      403,
    );
  if (!(await rateLimit("guest:start:" + c.hash, 10, 86400)))
    throw failure(
      "Trial sessions are limited on this network. Please sign in.",
      429,
    );
  const id = randomUUID();
  await checked(
    backend()
      .from("modolouge_people")
      .insert({ id, kind: "guest", last_ip: c.ip, location: c.location }),
  );
  const user = {
    id,
    sk: id,
    kind: "guest",
    guest_runs: 0,
    email: `Guest ${id.slice(0, 8)}`,
  };
  await syncWorkerUser(user);
  (await cookies()).set(guestName(), await seal({ id }, 2592000), {
    ...options(),
    maxAge: 2592000,
  });
  await activity(user, "trial_started", req);
  return user;
}
async function syncWorkerUser(u) {
  await update(
    "USERS",
    u.sk,
    "SET email=:email, kind=:kind, createdAt=if_not_exists(createdAt,:now), lastSeen=:now, blocked=:blocked",
    {
      ":email": u.email,
      ":kind": u.kind,
      ":now": new Date().toISOString(),
      ":blocked": !!u.blocked,
    },
  );
}
export async function authAction(action, req) {
  originCheck(req);
  if (Number(req.headers.get("content-length") || 0) > 10000)
    throw failure("Request too large.", 413);
  const b = await req.json();
  if (action === "send-code") {
    const email = String(b.email || "")
      .trim()
      .toLowerCase();
    if (email.length > 254 || !/^\S+@\S+\.\S+$/.test(email))
      throw failure("Enter a valid email address.");
    if (manager && email !== adminEmail)
      throw failure("Use the ToolWorksLab administrator email.", 403);
    const c = connection(req),
      hash = createHmac("sha256", process.env.IP_HASH_SECRET)
        .update(email)
        .digest("hex");
    if (
      !(await rateLimit("auth:ip:" + c.hash, 12, 3600)) ||
      !(await rateLimit("auth:email:" + hash, 1, 60))
    )
      throw failure(
        "Please wait a minute before requesting another code.",
        429,
      );
    const { error } = await authClient().auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error)
      throw failure("Email could not be sent. Please try again shortly.", 503);
    (await cookies()).set(cookieName() + "-flow", await seal({ email }, 900), {
      ...options(),
      maxAge: 900,
    });
    const guest = await read(guestName());
    await activity(
      guest?.id ? { sk: guest.id } : null,
      "verification_requested",
      req,
    );
    return { ok: true };
  }
  if (action === "verify-code") {
    const flow = await read(cookieName() + "-flow");
    if (!flow?.email) throw failure("Request a new sign-in code.", 401);
    const token = String(b.code || "").replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token))
      throw failure("Enter the code from your email.");
    const c = connection(req);
    if (!(await rateLimit("auth:verify:" + c.hash, 15, 900)))
      throw failure("Too many attempts. Request another code later.", 429);
    const { data, error } = await authClient().auth.verifyOtp({
      email: flow.email,
      token,
      type: "email",
    });
    if (
      error ||
      !data.session ||
      !data.user?.email_confirmed_at ||
      data.user.is_anonymous
    )
      throw failure(
        "That code is invalid or expired. Try again or request a new one.",
        401,
      );
    if (manager && data.user.email.toLowerCase() !== adminEmail)
      throw failure("Administrator access required.", 403);
    const guest = await read(guestName());
    await checked(
      backend().rpc("modolouge_link_account", {
        p_auth_id: data.user.id,
        p_guest: guest?.id || null,
      }),
    );
    const profile = await person(data.user.id);
    if (profile.blocked) throw failure("This account is disabled.", 403);
    const user = { ...profile, sk: profile.id };
    await syncWorkerUser(user);
    await saveSession(data.session);
    (await cookies()).delete(cookieName() + "-flow");
    await activity(user, guest?.id ? "trial_converted" : "signed_in", req, {
      guestId: guest?.id || null,
    });
    return { ok: true, onboarded: !!profile.onboarded_at };
  }
  if (action === "onboarding") {
    const u = await requireUser();
    const name = String(b.name || "")
        .trim()
        .slice(0, 80),
      discipline = String(b.discipline || "").slice(0, 80),
      intent = String(b.intent || "").slice(0, 160);
    if (!name) throw failure("Tell us what to call you.");
    await checked(
      backend()
        .from("modolouge_people")
        .update({
          display_name: name,
          discipline,
          intent,
          onboarded_at: new Date().toISOString(),
        })
        .eq("id", u.sk),
    );
    await activity(u, "onboarding_completed", req);
    return { ok: true };
  }
  throw failure("Not found.", 404);
}
export async function login() {
  return Response.redirect(process.env.APP_URL + "/signin", 303);
}
export async function callback() {
  return Response.redirect(process.env.APP_URL + "/signin", 303);
}
export async function logout(req) {
  originCheck(req);
  const s = await session();
  if (s?.access)
    await backend()
      .auth.admin.signOut(s.access, "local")
      .catch(() => {});
  (await cookies()).delete(cookieName());
  return Response.redirect(process.env.APP_URL + "/", 303);
}
export function safeError(error) {
  const status = error.status || 500;
  if (!error.status)
    console.error("request_failed", {
      name: error.name,
      code: error.code,
      requestId: error.$metadata?.requestId,
    });
  return Response.json(
    {
      error: error.status
        ? error.message
        : "The service could not complete this request. Please retry.",
      ...(error.status && error.code ? { code: error.code } : {}),
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
