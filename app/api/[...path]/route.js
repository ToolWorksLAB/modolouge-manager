import { get } from "../../../lib/aws.js";
import {
  requireUser,
  requireActor,
  startTrial,
  originCheck,
  safeError,
  failure,
} from "../../../lib/auth.js";
import { createUpload, submit, readJob } from "../../../lib/jobs.js";
import { manager, limits } from "../../../lib/config.js";
import { backend, checked } from "../../../lib/supabase.js";
import { connection, activity } from "../../../lib/activity.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req, { params }) {
  try {
    const p = (await params).path;
    if (p.join("/") === "status") {
      const s = await get("SERVICE");
      return Response.json(
        {
          online: !!s?.acceptingJobs && Date.now() - (s.heartbeat || 0) < 90000,
          acceptingJobs: !!s?.acceptingJobs,
          state: s?.desired || "unknown",
          version: s?.version || null,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (manager) throw failure("Not found.", 404);
    const u = await requireActor();
    if (p[0] === "jobs" && p.length === 2)
      return Response.json(await readJob(u, p[1]), {
        headers: { "Cache-Control": "no-store" },
      });
    if (p[0] === "me") {
      const q = await get(
        "QUOTA#" + new Date().toISOString().slice(0, 10),
        u.sk,
      );
      return Response.json(
        {
          kind: u.kind,
          name: u.display_name,
          intent: u.intent,
          onboarded: !!u.onboarded_at,
          email: u.email,
          dailyJobs: q?.jobs || 0,
          limit: u.kind === "guest" ? 5 : limits.dailyJobs,
          used: u.kind === "guest" ? u.guest_runs : q?.jobs || 0,
          remaining:
            u.kind === "guest"
              ? await remaining(u, req)
              : Math.max(0, limits.dailyJobs - (q?.jobs || 0)),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    throw failure("Not found.", 404);
  } catch (e) {
    return safeError(e);
  }
}
export async function POST(req, { params }) {
  try {
    originCheck(req);
    if (manager) throw failure("Not found.", 404);
    const path = (await params).path.join("/");
    if (path === "trial/start") {
      const u = await startTrial(req);
      return Response.json(
        { ok: true, kind: u.kind },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const u = await requireActor();
    if (Number(req.headers.get("content-length") || 0) > 100000)
      throw failure("Request too large.", 413);
    const b = await req.json(),
      p = (await params).path.join("/");
    if (p === "uploads") {
      if (u.kind === "guest" && (await remaining(u, req)) <= 0)
        throw failure(
          "Your five free runs are complete. Sign in to continue.",
          402,
          "TRIAL_EXHAUSTED",
        );
      const result = await createUpload(u, b, req);
      await activity(u, "definition_uploaded", req, {
        filename: b.filename,
        definitionId: result.id,
      });
      return Response.json(result);
    }
    if (p === "jobs")
      return Response.json(await submit(u, b, req), { status: 202 });
    throw failure("Not found.", 404);
  } catch (e) {
    return safeError(e);
  }
}
async function remaining(u, req) {
  const c = connection(req);
  const network = await checked(
    backend()
      .from("modolouge_limits")
      .select("used,expires_at")
      .eq("key", "trial:run:" + c.hash)
      .maybeSingle(),
  );
  const used =
    network && Date.parse(network.expires_at) > Date.now() ? network.used : 0;
  return Math.max(0, Math.min(5 - u.guest_runs, 5 - used));
}
