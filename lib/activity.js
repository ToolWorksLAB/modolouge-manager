import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { backend, checked } from "./supabase.js";
export function connection(req) {
  // Vercel overwrites this header at its edge. Local development never trusts it.
  const candidate =
    process.env.VERCEL === "1"
      ? (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
      : "127.0.0.1";
  const ip = isIP(candidate) ? candidate : null;
  let city = "";
  try {
    city = decodeURIComponent(req.headers.get("x-vercel-ip-city") || "");
  } catch {}
  const location =
    process.env.VERCEL === "1"
      ? {
          country: (req.headers.get("x-vercel-ip-country") || "Unknown").slice(
            0,
            60,
          ),
          region: (req.headers.get("x-vercel-ip-country-region") || "").slice(
            0,
            60,
          ),
          city: city.slice(0, 120),
        }
      : { country: "Local", city: "" };
  if (!process.env.IP_HASH_SECRET)
    throw new Error("Connection security is not configured.");
  return {
    ip,
    location,
    hash: createHmac("sha256", process.env.IP_HASH_SECRET)
      .update(ip || "unavailable")
      .digest("hex"),
  };
}
export async function activity(actor, event, req, detail = {}) {
  const c = connection(req);
  await checked(
    backend()
      .from("modolouge_activity")
      .insert({
        actor_id: actor?.sk || null,
        event,
        ip: c.ip,
        location: c.location,
        detail,
      }),
  );
  if (actor)
    await checked(
      backend()
        .from("modolouge_people")
        .update({
          last_seen: new Date().toISOString(),
          last_ip: c.ip,
          location: c.location,
        })
        .eq("id", actor.sk),
    );
}
export async function rateLimit(key, max, seconds) {
  return checked(
    backend().rpc("modolouge_take_limit", {
      p_key: key,
      p_max: max,
      p_seconds: seconds,
    }),
  );
}
export async function person(id) {
  return checked(
    backend().from("modolouge_people").select("*").eq("id", id).maybeSingle(),
  );
}
export async function owns(user, owner) {
  if (owner === user.sk) return true;
  if (user.kind !== "member") return false;
  const prior = await person(owner);
  return !prior?.blocked && prior?.linked_to === user.sk;
}
export async function reserveUsage(user, job, req) {
  const c = connection(req);
  try {
    await checked(
      backend().rpc("modolouge_reserve_job", {
        p_id: job.id,
        p_actor: user.sk,
        p_type: job.type,
        p_ip: c.ip,
        p_hash: c.hash,
        p_location: c.location,
      }),
    );
  } catch (e) {
    const message = e.databaseMessage || "";
    if (
      /TRIAL_EXHAUSTED|TRIAL_PREPARATION_LIMIT|SIGN_IN_REQUIRED/.test(message)
    ) {
      await activity(user, "trial_limit_reached", req).catch(() => {});
      throw Object.assign(
        new Error(
          /TRIAL_PREPARATION_LIMIT/.test(message)
            ? "Your trial preparation allowance is used. Create a free account to try more definitions."
            : "Your five free runs are complete. Create a free account to keep exploring.",
        ),
        { status: 402, code: "TRIAL_EXHAUSTED" },
      );
    }
    if (/ACCOUNT_BLOCKED/.test(message))
      throw Object.assign(new Error("This account is disabled."), {
        status: 403,
      });
    throw e;
  }
}
export const refundUsage = (id) =>
  checked(backend().rpc("modolouge_refund_job", { p_id: id }));
