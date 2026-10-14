import test, { mock } from "node:test";
import assert from "node:assert/strict";
process.env.SESSION_SECRET = "test-session-secret";
process.env.IP_HASH_SECRET = "test-ip-secret";
process.env.APP_URL = "https://admin.example";
const jar = new Map();
let allowed = true, blocked = false, verified = true, authEmail = "info@toolworkslab.com", passwordError = false;
let version = null;
const calls = [];
const user = () => ({ id:"admin", email:authEmail, email_confirmed_at:verified ? "2026-10-15" : null, is_anonymous:false, app_metadata:{admin_session_version:version} });
const result = () => ({ data:{user:user(),session:{user:user(),access_token:"access",refresh_token:"refresh",expires_at:Date.now()/1000+3600}},error:null });
mock.module("next/headers.js", { namedExports:{cookies:async()=>({get:name=>jar.has(name)?{value:jar.get(name)}:undefined,set:(name,value)=>jar.set(name,value),delete:name=>jar.delete(name)})} });
mock.module("../lib/aws.js", { namedExports:{update:async()=>{throw new Error("Password auth must not depend on AWS writes");}} });
mock.module("../lib/activity.js", { namedExports:{person:async()=>({id:"admin",blocked}),activity:async()=>{},connection:()=>({hash:"network"}),rateLimit:async()=>allowed} });
mock.module("../lib/supabase.js", { namedExports:{authClient:()=>({auth:{
  signInWithPassword:async body=>{calls.push(["password",body]);return passwordError ? {error:{message:"invalid"},data:{}} : result();},
  signInWithOtp:async body=>{calls.push(["otp",body]);return {error:null};},
  verifyOtp:async()=>result(),setSession:async()=>result(),getUser:async()=>({data:{user:user()}}),
  updateUser:async body=>{calls.push(["update",body]);return {error:null};},
}}),backend:()=>({auth:{admin:{
  updateUserById:async(id,body)=>{version=body.app_metadata.admin_session_version;calls.push(["version",id]);return {error:null};},
  signOut:async(token,scope)=>{calls.push(["signOut",scope]);return {error:null};},
}}}),checked:async()=>{} } });
const {authAction,requireUser} = await import("../lib/auth.js");
const request = body => new Request("https://admin.example/api/auth/action",{method:"POST",headers:{origin:"https://admin.example","content-type":"application/json"},body:JSON.stringify(body)});
const action = (name,body={}) => authAction(name,request(body));
test("password login creates a session without requesting email or AWS", async()=>{
  jar.clear();calls.length=0;
  assert.deepEqual(await action("password-login",{email:" INFO@TOOLWORKSLAB.COM ",password:"test-password"}),{ok:true});
  assert.equal(calls[0][0],"password");assert.equal(calls.length,1);
  assert.equal((await requireUser(true)).email,"info@toolworkslab.com");
});
test("wrong passwords, non-admins, unverified, blocked and throttled accounts are rejected", async()=>{
  await assert.rejects(action("password-login",{email:"other@example.com",password:"test"}),{status:401});
  passwordError=true;await assert.rejects(action("password-login",{email:authEmail,password:"test"}),{status:401});passwordError=false;
  verified=false;await assert.rejects(action("password-login",{email:authEmail,password:"test"}),{status:401});verified=true;
  blocked=true;await assert.rejects(action("password-login",{email:authEmail,password:"test"}),{status:403});blocked=false;
  allowed=false;await assert.rejects(action("password-login",{email:authEmail,password:"test"}),{status:429});allowed=true;
});
test("recovery is scoped, requires mailbox verification, and revokes old admin sessions", async()=>{
  jar.clear();
  await action("password-login",{email:authEmail,password:"test-password"});
  const oldSession=jar.get("__Host-modolouge-manager-v2");
  jar.clear();
  await assert.rejects(action("send-code",{email:authEmail}),{status:400});
  await assert.rejects(action("reset-password",{password:"a-unique-long-password"}),{status:401});
  await action("send-code",{email:authEmail,purpose:"password-recovery"});
  assert.equal(calls.findLast(c=>c[0]==="otp")[1].options.shouldCreateUser,false);
  await action("verify-code",{code:"12345678"});
  await assert.rejects(requireUser(true),{status:401});
  await assert.rejects(action("reset-password",{password:"short"}),{status:400});
  await action("reset-password",{password:"a-unique-long-password"});
  assert.equal(calls.findLast(c=>c[0]==="signOut")[1],"global");
  await assert.rejects(action("reset-password",{password:"a-unique-long-password"}),{status:401});
  jar.set("__Host-modolouge-manager-v2",oldSession);
  await assert.rejects(requireUser(true),{status:401});
  await action("password-login",{email:authEmail,password:"a-unique-long-password"});
  assert.equal((await requireUser(true)).email,authEmail);
});
test("cross-origin password requests are rejected before auth",async()=>{
  const req=new Request("https://admin.example/api/auth/password-login",{method:"POST",headers:{origin:"https://evil.example"},body:"{}"});
  await assert.rejects(authAction("password-login",req),{status:403});
});
