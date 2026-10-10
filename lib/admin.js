import { randomUUID } from "node:crypto";
import {
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";
import { all, recent, get, put, update, ec2 } from "./aws.js";
import { failure } from "./auth.js";
import { rates, estimate, limits } from "./config.js";
import { backend, checked } from "./supabase.js";
const instanceId = "i-0c6e3386ff6d66b5b";
export async function dashboard() {
  const month = new Date().toISOString().slice(0, 7);
  const [
    people,
    usage,
    rawEvents,
    activity,
    service,
    runtime,
    audit,
    instance,
    legacyUsers,
    legacyUsage,
  ] = await Promise.all([
    checked(
      backend()
        .from("modolouge_people")
        .select("*")
        .order("last_seen", { ascending: false })
        .limit(1000),
    ),
    checked(
      backend().rpc("modolouge_usage_summary", { p_month: month + "-01" }),
    ),
    checked(
      backend()
        .from("modolouge_compute_usage")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ),
    checked(
      backend()
        .from("modolouge_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ),
    get("SERVICE"),
    get("RUNTIME#" + month),
    recent("AUDIT", 30),
    ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] })),
    all("USERS"),
    all("USAGE#" + month),
  ]);
  const peopleMap = new Map(people.map((u) => [u.id, u]));
  const users = people.map((u) => {
    const measured = usage.find((x) => x.actor_id === u.id) || {};
    return {
      ...u,
      id: u.id,
      sk: u.id,
      email: u.email || "Guest " + u.id.slice(0, 8),
      createdAt: u.created_at,
      lastSeen: u.last_seen,
      ip: u.last_ip,
      jobs: Number(measured.jobs || 0),
      failed: Number(measured.failed || 0),
      seconds: measured.seconds || 0,
      estimatedCost: estimate(measured.seconds),
    };
  });
  // Keep historical Cognito usage visible instead of silently deleting it.
  for (const u of legacyUsers.filter(
    (u) => !peopleMap.has(u.sk) && u.kind !== "guest",
  )) {
    const measured = legacyUsage.find((x) => x.sk === u.sk) || {};
    users.push({
      ...u,
      id: u.sk,
      kind: "legacy",
      ...measured,
      estimatedCost: estimate(measured.seconds),
    });
  }
  const events = rawEvents.map((e) => ({
    ...e,
    status:
      ["queued", "running"].includes(e.status) &&
      Date.now() - Date.parse(e.created_at) > 240000
        ? "expired"
        : e.status,
    sk: e.id,
    createdAt: e.created_at,
    email:
      peopleMap.get(e.actor_id)?.email || "Guest " + e.actor_id.slice(0, 8),
  }));
  const state =
    instance.Reservations?.[0]?.Instances?.[0]?.State?.Name || "unknown";
  const totalSeconds = users.reduce((n, u) => n + (u.seconds || 0), 0),
    runningSeconds = runtime?.seconds || 0;
  return {
    month,
    users,
    activity: activity.map((e) => ({
      ...e,
      email:
        peopleMap.get(e.actor_id)?.email ||
        (e.actor_id ? "Guest " + e.actor_id.slice(0, 8) : "Visitor"),
    })),
    summary: {
      guests: people.filter((p) => p.kind === "guest").length,
      members: people.filter((p) => p.kind === "member").length,
      converted: people.filter((p) => p.linked_to).length,
      active: people.filter(
        (p) => Date.now() - Date.parse(p.last_seen) < 300000,
      ).length,
    },
    events,
    audit,
    service: {
      ...service,
      state,
      instanceId,
      region: "eu-north-1",
      online:
        !!service?.acceptingJobs &&
        Date.now() - (service?.heartbeat || 0) < 90000,
    },
    rates,
    limits,
    costs: {
      activeSeconds: totalSeconds,
      runningSeconds,
      userEstimate: estimate(totalSeconds),
      runtimeEstimate: estimate(runningSeconds),
      sharedEstimate: estimate(Math.max(0, runningSeconds - totalSeconds)),
      storageMonthly: rates.storageMonthly,
    },
  };
}
export async function control(user, action) {
  if (!["start", "stop"].includes(action))
    throw failure("Unknown service action.");
  if (action === "stop")
    await checked(
      backend()
        .from("modolouge_ai_settings")
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("id", true),
    );
  const now = Date.now(),
    id = randomUUID();
  try {
    await update(
      "SERVICE",
      "STATE",
      "SET operationUntil=:until, acceptingJobs=:no, desired=:desired, changedAt=:at, changedBy=:by",
      {
        ":until": now + 120000,
        ":no": false,
        ":desired": action === "start" ? "running" : "stopped",
        ":at": new Date(now).toISOString(),
        ":by": user.email,
        ":now": now,
      },
      {
        ConditionExpression:
          "attribute_not_exists(operationUntil) OR operationUntil < :now",
      },
    );
  } catch (e) {
    if (e.name === "ConditionalCheckFailedException")
      throw failure(
        "A service operation is already in progress. Refresh in a moment.",
        409,
      );
    throw e;
  }
  await put({
    pk: "AUDIT",
    sk: new Date(now).toISOString() + "#" + id,
    actor: user.email,
    action,
    createdAt: new Date(now).toISOString(),
    status: "requested",
  });
  try {
    const info = await ec2.send(
      new DescribeInstancesCommand({ InstanceIds: [instanceId] }),
    );
    const current = info.Reservations[0].Instances[0].State.Name;
    if (action === "stop" && current === "running")
      await ec2.send(new StopInstancesCommand({ InstanceIds: [instanceId] }));
    else if (action === "start" && current === "stopped")
      await ec2.send(new StartInstancesCommand({ InstanceIds: [instanceId] }));
    else if (!["running", "stopped"].includes(current))
      throw failure(
        "EC2 is " + current + ". Wait for the transition before changing it.",
        409,
      );
    await update(
      "AUDIT",
      new Date(now).toISOString() + "#" + id,
      "SET #status=:s",
      { ":s": "accepted" },
      { ExpressionAttributeNames: { "#status": "status" } },
    );
    return { state: action === "start" ? "starting" : "stopping" };
  } catch (e) {
    await update(
      "AUDIT",
      new Date(now).toISOString() + "#" + id,
      "SET #status=:s",
      { ":s": "failed" },
      { ExpressionAttributeNames: { "#status": "status" } },
    );
    throw e;
  } finally {
    await update("SERVICE", "STATE", "SET operationUntil=:zero", {
      ":zero": 0,
    });
  }
}
export async function block(user, id, blocked) {
  if (typeof blocked !== "boolean") throw failure("Invalid account state.");
  const target =
    (await checked(
      backend().from("modolouge_people").select("*").eq("id", id).maybeSingle(),
    )) || (await get("USERS", id));
  if (!target) throw failure("User not found.", 404);
  if (target.email === "info@toolworkslab.com")
    throw failure("The administrator cannot be blocked.");
  await checked(
    backend().from("modolouge_people").update({ blocked }).eq("id", id),
  );
  await update("USERS", id, "SET blocked=:b", { ":b": blocked });
  await put({
    pk: "AUDIT",
    sk: new Date().toISOString() + "#" + randomUUID(),
    actor: user.email,
    action: blocked ? "block-user" : "unblock-user",
    target: target.email || "Guest " + id.slice(0, 8),
    createdAt: new Date().toISOString(),
    status: "accepted",
  });
  return { ok: true };
}
