import test, { mock } from "node:test";
import assert from "node:assert/strict";
process.env.IP_HASH_SECRET = "test-only-demo-secret";
let writes = [], limited = false, adminAllowed = false;
mock.module("../lib/supabase.js", { namedExports: {
  checked: async value => value,
  backend: () => ({
    from: name => ({ insert: async value => { writes.push({ name, value }); return value; } }),
    rpc: async (name, value) => { writes.push({ name, value }); return name === "modolouge_demo_report" ? { summary: { visits: 1 } } : null; },
  }),
} });
mock.module("../lib/activity.js", { namedExports: {
  connection: () => ({ ip: "192.0.2.42", location: { country: "ES", city: "Barcelona" } }),
  rateLimit: async () => !limited,
} });
const mod = await import("../lib/demo-visitors.js");
const route = await import("../app/api/demo/visit/route.js");
const request = (body, origin = mod.demoOrigin) => new Request("https://admin.toolworkslab.com/api/demo/visit", { method: "POST", headers: { origin, "user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0.0.0 Safari/537.36", "content-type": "text/plain" }, body: JSON.stringify(body) });
test("signed visit tokens reject tampering and expiry", () => {
  const id = "00000000-0000-4000-8000-000000000001", token = mod.issueToken(id, 1000);
  assert.equal(mod.verifyToken(token, 1001), id);
  assert.throws(()=>mod.verifyToken(token+"x",1001), {status:401});
  assert.throws(()=>mod.verifyToken(token,21601001), {status:401});
  assert.throws(()=>mod.verifyToken("garbage",1001), {status:401});
});
test("network and referrer storage exclude identifying suffixes and query strings", () => {
  assert.equal(mod.maskedIp("192.0.2.42"),"192.0.2.0/24");
  assert.equal(mod.maskedIp("2001:db8:abcd:1234::42"),"2001:db8:abcd::/48");
  assert.equal(mod.maskedIp("::1"),"0:0:0::/48");
  assert.equal(mod.maskedIp("invalid"),null);
  assert.equal(mod.referrerDomain("https://example.com/private?email=person@example.com"),"example.com");
  assert.equal(mod.referrerDomain("file:///secret"),null);
});
test("device classification covers mobile, tablet, desktop and browser families", () => {
  assert.deepEqual(mod.deviceInfo("Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36 Edg/130.0"),{device:"Desktop",os:"Windows",browser:"Edge"});
  assert.equal(mod.deviceInfo("Mozilla/5.0 (iPhone) Mobile Safari/604.1").device,"Mobile");
  assert.equal(mod.deviceInfo("Mozilla/5.0 (iPad) Mobile Safari/604.1").device,"Tablet");
  assert.equal(mod.deviceInfo("Mozilla/5.0 (Macintosh) Safari/604.1",true).os,"iOS / iPadOS");
});
test("endpoint requires exact origin, explicit consent and bounded input before writing", async () => {
  writes=[];
  for (const origin of ["https://demo.toolworkslab.com.evil.invalid","null","https://admin.toolworkslab.com"]) assert.equal((await route.POST(request({type:"start",consent:true,section:"intro"},origin))).status,403);
  assert.equal((await route.POST(request({type:"start",section:"intro"}))).status,400);
  assert.equal((await route.POST(request({type:"start",consent:true,section:"intro",large:"x".repeat(5000)}))).status,413);
  assert.equal(writes.length,0);
});
test("start stores only coarse metadata; pulse needs signed session and sanitized counters", async () => {
  writes=[];
  const started=await route.POST(request({type:"start",consent:true,section:"intro",referrer:"https://example.org/path?private=yes",email:"should-not-be-stored"}));
  assert.equal(started.status,200);
  assert.equal(started.headers.get("access-control-allow-origin"),mod.demoOrigin);
  const {token}=await started.json();
  assert.equal(writes[0].value.masked_ip,"192.0.2.0/24");
  assert.equal(writes[0].value.referrer,"example.org");
  assert.equal(writes[0].value.email,undefined);
  assert.equal(writes[0].value.ip,undefined);
  assert.equal((await route.POST(request({type:"pulse",consent:true,section:"wedges",token,seq:1,activeSeconds:10,events:{wedges:1,private:"not saved"}}))).status,200);
  assert.equal(writes[1].value.p_events.private,undefined);
  assert.equal((await route.POST(request({type:"pulse",consent:true,section:"wedges",token:"forged",seq:2,activeSeconds:10}))).status,401);
  assert.equal((await route.POST(request({type:"pulse",consent:true,section:"wedges",token,seq:3,activeSeconds:-10}))).status,400);
});
test("rate-limited requests do not create sessions", async () => {
  limited=true; writes=[];
  assert.equal((await route.POST(request({type:"start",consent:true,section:"intro"}))).status,429);
  assert.equal(writes.length,0); limited=false;
});
mock.module("../lib/auth.js", { namedExports: {
  requireUser: async admin => { assert.equal(admin,true); if(!adminAllowed) throw Object.assign(new Error("Sign in"),{status:401}); return {}; },
  failure: (message,status)=>Object.assign(new Error(message),{status}),
  safeError: error=>Response.json({error:error.message},{status:error.status||500}),
  originCheck: ()=>{},
} });
mock.module("../lib/admin.js", { namedExports: { dashboard:async()=>({}),control:async()=>({}),block:async()=>({}) } });
mock.module("../lib/ai-admin.js", { namedExports: { aiDashboard:async()=>({}),aiSettings:async()=>({}) } });
const adminRoute=await import("../app/api/admin/[action]/route.js");
test("visitor dashboard enforces administrator authentication",async()=>{
  const req=new Request("https://admin.toolworkslab.com/api/admin/demo-visitors?days=7"), ctx={params:Promise.resolve({action:"demo-visitors"})};
  writes=[];
  assert.equal((await adminRoute.GET(req,ctx)).status,401);
  assert.equal(writes.length,0);
  adminAllowed=true;
  assert.equal((await adminRoute.GET(req,ctx)).status,200);
  assert.equal(writes[0].name,"modolouge_demo_report");
});
