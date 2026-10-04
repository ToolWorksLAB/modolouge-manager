import { get } from "../../../lib/aws.js";
import {
  requireUser,
  originCheck,
  safeError,
  failure,
} from "../../../lib/auth.js";
import { createUpload, submit, readJob } from "../../../lib/jobs.js";
import { manager, limits } from "../../../lib/config.js";
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
    const u = await requireUser();
    if (p[0] === "jobs" && p.length === 2)
      return Response.json(await readJob(u, p[1]), {
        headers: { "Cache-Control": "no-store" },
      });
    if (p[0] === "me") {
      const q = await get(
        "QUOTA#" + new Date().toISOString().slice(0, 10),
        u.sk,
      );
      return Response.json({
        email: u.email,
        dailyJobs: q?.jobs || 0,
        limit: limits.dailyJobs,
      });
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
    const u = await requireUser();
    if (Number(req.headers.get("content-length") || 0) > 100000)
      throw failure("Request too large.", 413);
    const b = await req.json(),
      p = (await params).path.join("/");
    if (p === "uploads") return Response.json(await createUpload(u, b));
    if (p === "jobs")
      return Response.json(await submit(u, b, req), { status: 202 });
    throw failure("Not found.", 404);
  } catch (e) {
    return safeError(e);
  }
}
