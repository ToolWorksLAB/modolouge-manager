import { demoOrigin, recordDemoVisit } from "../../../../lib/demo-visitors.js";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Access-Control-Allow-Origin": demoOrigin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-store", Vary: "Origin" };
export async function OPTIONS(req) {
  return new Response(null, { status: req.headers.get("origin") === demoOrigin ? 204 : 403, headers });
}
export async function POST(req) {
  if (req.headers.get("origin") !== demoOrigin) return Response.json({ error: "Origin not allowed." }, { status: 403 });
  try {
    if (Number(req.headers.get("content-length") || 0) > 4096) return new Response(null, { status: 413, headers });
    // Bound streamed bodies too: Content-Length may be absent.
    const reader = req.body?.getReader();
    if (!reader) return new Response(null, { status: 400, headers });
    const chunks = []; let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
      chunks.push(Buffer.from(value));
    }
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return new Response(null, { status: 400, headers }); }
    return Response.json(await recordDemoVisit(req, body), { headers });
  } catch (error) {
    if (!error.status) console.error("demo_analytics_failed", { code: error.code });
    return Response.json({ error: error.status ? error.message : "Analytics unavailable." }, { status: error.status || 503, headers });
  }
}
