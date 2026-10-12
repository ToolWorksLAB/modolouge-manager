import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { backend, checked } from "./supabase.js";
import { connection, rateLimit } from "./activity.js";

export const demoOrigin = "https://demo.toolworkslab.com";
export const events = ["tour_started", "tour_completed", "wedges", "surface", "cutouts", "export", "download_gcode", "download_stl", "download_settings", "download_image", "brief_opened"];
const sections = ["intro", "engines", "wedges", "surface", "cutouts", "export"];
const invalid = (message, status = 400) => Object.assign(new Error(message), { status });
const secret = () => {
  if (!process.env.IP_HASH_SECRET) throw new Error("Analytics configuration unavailable.");
  return process.env.IP_HASH_SECRET;
};
const signature = value => createHmac("sha256", secret()).update("demo-session-v1:" + value).digest("base64url");
export function issueToken(id, now = Date.now()) {
  const value = Buffer.from(JSON.stringify({ id, expires: now + 21600000 })).toString("base64url");
  return value + "." + signature(value);
}
export function verifyToken(token, now = Date.now()) {
  if (typeof token !== "string" || token.length > 512) throw invalid("Invalid visit.", 401);
  const [value, mac, extra] = token.split(".");
  const expected = Buffer.from(signature(value || ""));
  const supplied = Buffer.from(mac || "");
  if (extra || supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) throw invalid("Invalid visit.", 401);
  let data;
  try { data = JSON.parse(Buffer.from(value, "base64url").toString()); } catch { throw invalid("Invalid visit.", 401); }
  if (!/^[a-f0-9-]{36}$/.test(data.id || "") || !Number.isFinite(data.expires) || data.expires < now || data.expires > now + 21600000) throw invalid("Visit expired.", 401);
  return data.id;
}
export function maskedIp(ip) {
  if (isIP(ip || "") === 4) return ip.split(".").slice(0, 3).join(".") + ".0/24";
  if (isIP(ip || "") === 6) {
    // URL canonicalization expands neither hostnames nor remote resources.
    const normalized = new URL("http://[" + ip + "]/").hostname.slice(1, -1);
    const [left, right = ""] = normalized.split("::");
    const a = left ? left.split(":") : [], b = right ? right.split(":") : [];
    const parts = normalized.includes("::") ? [...a, ...Array(8 - a.length - b.length).fill("0"), ...b] : a;
    return parts.slice(0, 3).join(":") + "::/48";
  }
  return null;
}
export function deviceInfo(ua = "", mobileHint = false) {
  const tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) || (/Macintosh/i.test(ua) && mobileHint);
  return {
    device: tablet ? "Tablet" : /Mobile|iPhone|iPod/i.test(ua) || mobileHint ? "Mobile" : ua ? "Desktop" : "Unknown",
    browser: /Edg[A\/]/i.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Chrome|CriOS/.test(ua) ? "Chrome" : /Safari/.test(ua) ? "Safari" : "Other",
    os: /iPhone|iPad|iPod/.test(ua) || tablet && /Macintosh/.test(ua) ? "iOS / iPadOS" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /CrOS/.test(ua) ? "ChromeOS" : /Macintosh|Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Other",
  };
}
export function validatePayload(body) {
  if (!body || typeof body !== "object" || body.consent !== true || !["start", "pulse"].includes(body.type)) throw invalid("Analytics consent is required.");
  if (!sections.includes(body.section)) throw invalid("Invalid section.");
  if (body.type === "start") return { type: "start", section: body.section };
  if (!Number.isInteger(body.seq) || body.seq < 1 || body.seq > 100000 || !Number.isInteger(body.activeSeconds) || body.activeSeconds < 0 || body.activeSeconds > 21600) throw invalid("Invalid visit timing.");
  const counts = {};
  for (const event of events) {
    const count = body.events?.[event] ?? 0;
    if (!Number.isInteger(count) || count < 0 || count > 10000) throw invalid("Invalid activity count.");
    counts[event] = count;
  }
  return { type: "pulse", section: body.section, seq: body.seq, activeSeconds: body.activeSeconds, events: counts, ended: body.ended === true };
}
export function referrerDomain(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.hostname !== "demo.toolworkslab.com" ? url.hostname.slice(0, 180) : null;
  } catch { return null; }
}
export async function recordDemoVisit(req, body) {
  const input = validatePayload(body), c = connection(req);
  if (!c.ip) throw invalid("Connection unavailable.", 403);
  const ua = (req.headers.get("user-agent") || "").slice(0, 1000);
  if (/bot|crawler|spider|headless|preview/i.test(ua)) return { ignored: true };
  const networkKey = createHmac("sha256", secret()).update("demo-rate:" + new Date().toISOString().slice(0, 10) + ":" + c.ip).digest("hex");
  if (!(await rateLimit("demo:pulse:" + networkKey, 240, 60))) throw invalid("Please try later.", 429);
  if (input.type === "start") {
    if (!(await rateLimit("demo:start:" + networkKey, 60, 3600)) || !(await rateLimit("demo:daily", 5000, 86400))) throw invalid("Please try later.", 429);
    const id = randomUUID();
    await checked(backend().from("modolouge_demo_visits").insert({
      id, section: input.section, ...deviceInfo(ua, req.headers.get("sec-ch-ua-mobile") === "?1"),
      country: c.location.country || "Unknown", region: c.location.region || "", city: c.location.city || "",
      masked_ip: maskedIp(c.ip), referrer: referrerDomain(body.referrer),
    }));
    return { token: issueToken(id), id };
  }
  const id = verifyToken(body.token);
  await checked(backend().rpc("modolouge_demo_pulse", { p_id: id, p_seq: input.seq, p_active: input.activeSeconds, p_events: input.events, p_section: input.section, p_ended: input.ended }));
  return { ok: true };
}
export async function demoDashboard(req) {
  const query = new URL(req.url).searchParams;
  const days = Number(query.get("days") || 7), offset = Number(query.get("offset") || 0);
  if (![1, 7, 30, 90].includes(days) || !Number.isInteger(offset) || offset < 0 || offset > 100000) throw invalid("Invalid date range.");
  return checked(backend().rpc("modolouge_demo_report", { p_days: days, p_offset: offset }));
}
