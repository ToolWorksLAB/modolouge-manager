import { manager } from "../../../../lib/config.js";
import {
  requireUser,
  originCheck,
  failure,
  safeError,
} from "../../../../lib/auth.js";
import { dashboard, control, block } from "../../../../lib/admin.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req, { params }) {
  try {
    if (!manager) throw failure("Not found.", 404);
    await requireUser(true);
    if ((await params).action === "dashboard")
      return Response.json(await dashboard(), {
        headers: { "Cache-Control": "no-store" },
      });
    throw failure("Not found.", 404);
  } catch (e) {
    return safeError(e);
  }
}
export async function POST(req, { params }) {
  try {
    originCheck(req);
    if (!manager) throw failure("Not found.", 404);
    const u = await requireUser(true),
      b = await req.json(),
      a = (await params).action;
    if (a === "service") return Response.json(await control(u, b.action));
    if (a === "users") return Response.json(await block(u, b.id, b.blocked));
    throw failure("Not found.", 404);
  } catch (e) {
    return safeError(e);
  }
}
