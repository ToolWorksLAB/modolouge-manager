import { backend, checked } from "./supabase.js";
import { failure } from "./auth.js";
import { activity } from "./activity.js";
export async function aiDashboard() {
  const since = new Date().toISOString().slice(0, 7) + "-01T00:00:00Z";
  const [summary, events, settings, people] = await Promise.all([
    checked(backend().rpc("modolouge_ai_summary", { p_since: since })),
    checked(
      backend()
        .from("modolouge_ai_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ),
    checked(backend().from("modolouge_ai_settings").select("*").single()),
    checked(
      backend()
        .from("modolouge_people")
        .select("id,email,last_ip,location")
        .order("last_seen", { ascending: false })
        .limit(1000),
    ),
  ]);
  const lookup = new Map(people.map((p) => [p.id, p]));
  const identity = (id) => {
    const p = lookup.get(id);
    return {
      email: p?.email || "Guest " + id.slice(0, 8),
      ip: p?.last_ip,
      location: p?.location,
    };
  };
  return {
    since,
    settings,
    summary: summary.map((s) => ({ ...s, ...identity(s.actor_id) })),
    events: events.map((e) => ({
      ...e,
      ...identity(e.actor_id),
      ip: e.ip,
      location: e.location,
      status:
        e.status === "running" && Date.now() - Date.parse(e.created_at) > 180000
          ? "interrupted"
          : e.status,
    })),
  };
}
export async function aiSettings(user, body, req) {
  if (
    typeof body.enabled !== "boolean" ||
    typeof body.daily_budget_usd !== "number" ||
    !Number.isFinite(body.daily_budget_usd) ||
    body.daily_budget_usd < 0 ||
    body.daily_budget_usd > 100
  )
    throw failure("Choose an AI budget between $0 and $100 per day.");
  await checked(
    backend()
      .from("modolouge_ai_settings")
      .update({
        enabled: body.enabled,
        daily_budget_usd: body.daily_budget_usd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true),
  );
  await activity(user, "ai_settings_changed", req, {
    enabled: body.enabled,
    dailyBudgetUsd: body.daily_budget_usd,
  });
  return { ok: true };
}
