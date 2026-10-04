import { randomUUID } from "node:crypto";
import {
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
} from "@aws-sdk/client-ec2";
import { all, recent, get, put, update, ec2 } from "./aws.js";
import { failure } from "./auth.js";
import { rates, estimate, limits } from "./config.js";
const instanceId = "i-0c6e3386ff6d66b5b";
export async function dashboard() {
  const month = new Date().toISOString().slice(0, 7);
  const [users, usage, events, service, runtime, audit, instance] =
    await Promise.all([
      all("USERS"),
      all("USAGE#" + month),
      recent("EVENTS#" + month),
      get("SERVICE"),
      get("RUNTIME#" + month),
      recent("AUDIT", 30),
      ec2.send(new DescribeInstancesCommand({ InstanceIds: [instanceId] })),
    ]);
  const state =
    instance.Reservations?.[0]?.Instances?.[0]?.State?.Name || "unknown";
  const totalSeconds = usage.reduce((n, u) => n + (u.seconds || 0), 0),
    runningSeconds = runtime?.seconds || 0;
  return {
    month,
    users: users.map((u) => ({
      id: u.sk,
      email: u.email,
      blocked: u.blocked,
      createdAt: u.createdAt,
      lastSeen: u.lastSeen,
      location: u.location,
      ...(usage.find((x) => x.sk === u.sk) || {}),
      estimatedCost: estimate(usage.find((x) => x.sk === u.sk)?.seconds),
    })),
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
  const target = await get("USERS", id);
  if (!target) throw failure("User not found.", 404);
  if (target.email === "info@toolworkslab.com")
    throw failure("The administrator cannot be blocked.");
  await update("USERS", id, "SET blocked=:b", { ":b": blocked });
  await put({
    pk: "AUDIT",
    sk: new Date().toISOString() + "#" + randomUUID(),
    actor: user.email,
    action: blocked ? "block-user" : "unblock-user",
    target: target.email,
    createdAt: new Date().toISOString(),
    status: "accepted",
  });
  return { ok: true };
}
