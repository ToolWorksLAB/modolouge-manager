import { cookies } from "next/headers.js";
import { EncryptJWT, jwtDecrypt, createRemoteJWKSet, jwtVerify } from "jose";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { get, update } from "./aws.js";
import { manager } from "./config.js";
export const adminEmail = "info@toolworkslab.com";
const cookieName = manager ? "__Host-modolouge-manager" : "__Host-modolouge";
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};
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
const unseal = async (value) =>
  (await jwtDecrypt(value, key(), { clockTolerance: 5 })).payload;
export function failure(message, status = 400) {
  return Object.assign(new Error(message), { status });
}
export function originCheck(req) {
  if (req.headers.get("origin") !== new URL(process.env.APP_URL).origin)
    throw failure("This request must originate from this application.", 403);
}
export async function session() {
  const raw = (await cookies()).get(cookieName)?.value;
  if (!raw) return null;
  try {
    return await unseal(raw);
  } catch {
    return null;
  }
}
export async function requireUser(admin = false) {
  const s = await session();
  if (!s?.sub) throw failure("Sign in to continue.", 401);
  const u = await get("USERS", s.sub);
  if (!u || u.blocked) throw failure("This account is disabled.", 403);
  if (admin && u.email !== adminEmail)
    throw failure("Administrator access required.", 403);
  return u;
}
export async function login(req) {
  const state = randomBytes(24).toString("base64url"),
    nonce = randomBytes(24).toString("base64url"),
    verifier = randomBytes(48).toString("base64url");
  (await cookies()).set(
    cookieName + "-flow",
    await seal({ state, nonce, verifier }, 600),
    { ...cookieOptions, maxAge: 600 },
  );
  const u = new URL("/oauth2/authorize", process.env.COGNITO_DOMAIN);
  u.search = new URLSearchParams({
    client_id: process.env.COGNITO_CLIENT_ID,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: process.env.APP_URL + "/api/auth/callback",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    ...(new URL(req.url).searchParams.has("signup")
      ? { screen_hint: "signup" }
      : {}),
  }).toString();
  return Response.redirect(u);
}
let jwks;
export async function callback(req) {
  const q = new URL(req.url).searchParams,
    jar = await cookies(),
    raw = jar.get(cookieName + "-flow")?.value;
  jar.delete(cookieName + "-flow");
  if (!raw || !q.get("code"))
    throw failure("Sign-in was not completed. Please try again.");
  const flow = await unseal(raw),
    state = q.get("state") || "";
  if (
    state.length !== flow.state.length ||
    !timingSafeEqual(Buffer.from(state), Buffer.from(flow.state))
  )
    throw failure("Sign-in state did not match.", 403);
  const response = await fetch(process.env.COGNITO_DOMAIN + "/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.COGNITO_CLIENT_ID,
      code: q.get("code"),
      redirect_uri: process.env.APP_URL + "/api/auth/callback",
      code_verifier: flow.verifier,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok)
    throw failure("Could not complete sign-in. Please try again.", 401);
  const tokens = await response.json(),
    issuer =
      "https://cognito-idp.eu-north-1.amazonaws.com/" +
      process.env.COGNITO_POOL_ID;
  jwks ||= createRemoteJWKSet(new URL(issuer + "/.well-known/jwks.json"));
  const { payload: p } = await jwtVerify(tokens.id_token, jwks, {
    issuer,
    audience: process.env.COGNITO_CLIENT_ID,
    algorithms: ["RS256"],
  });
  if (
    p.token_use !== "id" ||
    p.nonce !== flow.nonce ||
    p.email_verified !== true ||
    typeof p.email !== "string"
  )
    throw failure("A verified email address is required.", 403);
  const email = p.email.toLowerCase();
  if (manager && email !== adminEmail)
    throw failure(
      "This panel is reserved for the ToolWorksLab administrator.",
      403,
    );
  const now = new Date().toISOString();
  await update(
    "USERS",
    p.sub,
    "SET email=:email, createdAt=if_not_exists(createdAt,:now), lastSeen=:now, blocked=if_not_exists(blocked,:no)",
    { ":email": email, ":now": now, ":no": false },
  );
  if ((await get("USERS", p.sub)).blocked)
    throw failure("This account is disabled.", 403);
  jar.set(cookieName, await seal({ sub: p.sub }, 3600), {
    ...cookieOptions,
    maxAge: 3600,
  });
  return Response.redirect(process.env.APP_URL + "/");
}
export async function logout(req) {
  originCheck(req);
  (await cookies()).delete(cookieName);
  const u = new URL("/logout", process.env.COGNITO_DOMAIN);
  u.search = new URLSearchParams({
    client_id: process.env.COGNITO_CLIENT_ID,
    logout_uri: process.env.APP_URL + "/",
  }).toString();
  return Response.redirect(u, 303);
}
export function safeError(error) {
  const status = error.status || 500;
  if (!error.status) console.error("request_failed", error.name || "Error");
  return Response.json(
    {
      error: error.status
        ? error.message
        : "The service could not complete this request. Please retry.",
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
