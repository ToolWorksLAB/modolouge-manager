"use client";
import { useState, useEffect } from "react";
import { api } from "./Workspace.jsx";
const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n || 0);
const duration = (n) =>
  Number(n || 0) < 60
    ? `${Number(n || 0).toFixed(1)} s`
    : `${(Number(n || 0) / 60).toFixed(1)} min`;
const when = (s) => (s ? new Date(s).toLocaleString() : "—");
export default function Manager() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [search, setSearch] = useState(""),
    [tab, setTab] = useState("users");
  async function refresh() {
    try {
      setData(await api("admin/dashboard"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 15000);
    return () => clearInterval(i);
  }, []);
  async function control(action) {
    setBusy(true);
    setError("");
    try {
      await api("admin/service", { action });
      setConfirm(false);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function block(u) {
    setBusy(true);
    try {
      await api("admin/users", { id: u.id, blocked: !u.blocked });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function csv() {
    const rows = [
      [
        "email",
        "jobs",
        "failed",
        "compute_seconds",
        "estimated_usd",
        "country",
        "city",
      ],
      ...data.users.map((u) => [
        u.email,
        u.jobs || 0,
        u.failed || 0,
        u.seconds || 0,
        u.estimatedCost,
        u.location?.country || "",
        u.location?.city || "",
      ]),
    ];
    const cell = (v) =>
      '"' +
      String(v)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const blob = new Blob(
        [rows.map((r) => r.map(cell).join(",")).join("\r\n")],
        { type: "text/csv" },
      ),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `modolouge-usage-${data.month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const users =
      data?.users.filter((u) =>
        u.email.toLowerCase().includes(search.toLowerCase()),
      ) || [],
    jobs = data?.users.reduce((n, u) => n + (u.jobs || 0), 0) || 0;
  return (
    <main className="manager">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            MODOLOUGE / MANAGER / {data?.month || "OPERATIONS"}
          </div>
          <h1>
            Every input. In perspective<span className="pink">.</span>
          </h1>
        </div>
        <button className="button quiet" onClick={refresh}>
          Refresh ↻
        </button>
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
      {!data ? (
        <div className="loading-card">Reading service activity…</div>
      ) : (
        <>
          <section className="service-card">
            <div>
              <span
                className={"status " + (data.service.online ? "online" : "")}
              >
                <i />
                {data.service.online
                  ? "Compute is online"
                  : `Compute is ${data.service.state}`}
              </span>
              <h2>
                {data.service.online
                  ? "Ready for the next idea."
                  : data.service.state === "stopped"
                    ? "Taking a pause."
                    : "A moment between states."}
              </h2>
              <p>Ubuntu Linux · Rhino.Compute 9 · Stockholm · c6i.xlarge</p>
              <span className="fine">
                Last heartbeat: {when(data.service.heartbeat)}
              </span>
            </div>
            <div className="service-actions">
              <div className="hourly">
                <strong>
                  {money(
                    data.service.state === "stopped"
                      ? 0
                      : data.rates.ec2Hourly +
                          data.rates.rhinoCoreHourly *
                            data.rates.billableCores +
                          data.rates.ipv4Hourly,
                  )}
                </strong>
                <span>/ hour estimated runtime</span>
              </div>
              <button
                className={
                  "button " +
                  (data.service.state === "stopped" ? "primary" : "danger")
                }
                disabled={
                  busy || !["running", "stopped"].includes(data.service.state)
                }
                onClick={() =>
                  data.service.state === "stopped"
                    ? control("start")
                    : setConfirm(true)
                }
              >
                {data.service.state === "stopped"
                  ? "Start compute ↗"
                  : "Shut down compute"}
              </button>
            </div>
          </section>
          {confirm && (
            <section className="confirm notice">
              <h2>Shut down this compute server?</h2>
              <p>
                New jobs will be disabled and the Linux EC2 instance will stop.
                Running jobs may be interrupted. This manager stays available so
                you can restart it.
              </p>
              <p>
                Retained Linux storage is about{" "}
                {money(data.costs.storageMonthly)}/month. Other AWS storage,
                Vercel, authentication and transfer charges can remain. This
                does not delete infrastructure.
              </p>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => control("stop")}
              >
                {busy ? "Stopping…" : "Stop the service"}
              </button>{" "}
              <button
                className="button quiet"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Keep running
              </button>
            </section>
          )}
          <section className="metrics">
            <article>
              <span className="eyebrow">VERIFIED ACCOUNTS</span>
              <strong>{data.users.length}</strong>
              <p>
                {
                  data.users.filter(
                    (u) => Date.now() - Date.parse(u.lastSeen || 0) < 300000,
                  ).length
                }{" "}
                active in the last 5 minutes
              </p>
            </article>
            <article>
              <span className="eyebrow">JOBS THIS MONTH</span>
              <strong>{jobs.toLocaleString()}</strong>
              <p>
                {duration(data.costs.activeSeconds)} measured processing time
              </p>
            </article>
            <article>
              <span className="eyebrow">USER COMPUTE ESTIMATE</span>
              <strong>{money(data.costs.userEstimate)}</strong>
              <p>Allocated by measured job time</p>
            </article>
            <article>
              <span className="eyebrow">SHARED RUNTIME ESTIMATE</span>
              <strong>{money(data.costs.sharedEstimate)}</strong>
              <p>Idle and unattributed runtime</p>
            </article>
          </section>
          <section className="data-panel">
            <div className="data-heading">
              <div className="pill-nav">
                {["users", "activity", "audit"].map((t) => (
                  <button
                    key={t}
                    className={tab === t ? "selected" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t === "users"
                      ? "People & usage"
                      : t === "activity"
                        ? "Recent jobs"
                        : "Control history"}
                  </button>
                ))}
              </div>
              <div className="table-tools">
                {tab === "users" && (
                  <input
                    aria-label="Find a user"
                    placeholder="Find an email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                )}
                <button className="quiet" onClick={csv}>
                  Export usage ↗
                </button>
              </div>
            </div>
            <div className="table-scroll">
              {tab === "users" ? (
                <table>
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>Connection</th>
                      <th>Jobs</th>
                      <th>Compute time</th>
                      <th>Estimate / USD</th>
                      <th>Last seen</th>
                      <th>Access</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.email}</strong>
                          <small>
                            Joined {new Date(u.createdAt).toLocaleDateString()}
                          </small>
                        </td>
                        <td>
                          {[u.location?.city, u.location?.country]
                            .filter(Boolean)
                            .join(", ") || "Not recorded"}
                        </td>
                        <td>
                          {u.jobs || 0}
                          <small>{u.failed || 0} failed</small>
                        </td>
                        <td>{duration(u.seconds)}</td>
                        <td>{money(u.estimatedCost)}</td>
                        <td>{when(u.lastSeen)}</td>
                        <td>
                          {u.email === "info@toolworkslab.com" ? (
                            <span className="tag">Admin</span>
                          ) : (
                            <button
                              className="quiet"
                              disabled={busy}
                              onClick={() => block(u)}
                            >
                              {u.blocked ? "Unblock" : "Block"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!users.length && (
                      <tr>
                        <td colSpan="7" className="empty-table">
                          No matching users yet. Verified sign-ins appear here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : tab === "activity" ? (
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Person</th>
                      <th>Job</th>
                      <th>Outcome</th>
                      <th>Duration</th>
                      <th>Connection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e) => (
                      <tr key={e.sk}>
                        <td>{when(e.createdAt)}</td>
                        <td>{e.email}</td>
                        <td>{e.type}</td>
                        <td>
                          <span className="tag">{e.status}</span>
                        </td>
                        <td>{duration(e.seconds)}</td>
                        <td>
                          {[e.location?.city, e.location?.country]
                            .filter(Boolean)
                            .join(", ") || "Unknown"}
                        </td>
                      </tr>
                    ))}
                    {!data.events.length && (
                      <tr>
                        <td colSpan="6" className="empty-table">
                          No jobs recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Administrator</th>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((e) => (
                      <tr key={e.sk}>
                        <td>{when(e.createdAt)}</td>
                        <td>{e.actor}</td>
                        <td>{e.action}</td>
                        <td>{e.target || "Linux compute"}</td>
                        <td>{e.status}</td>
                      </tr>
                    ))}
                    {!data.audit.length && (
                      <tr>
                        <td colSpan="5" className="empty-table">
                          No administrative actions yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </section>
          <section className="cost-notes">
            <div>
              <span className="eyebrow">THE COST MODEL</span>
              <h2>
                Useful estimates.
                <br />
                With the assumptions visible.
              </h2>
            </div>
            <div>
              <p>
                Runtime uses AWS {money(data.rates.ec2Hourly)}/hour + public
                IPv4 {money(data.rates.ipv4Hourly)}/hour + Rhino{" "}
                {money(data.rates.rhinoCoreHourly)}/core-hour ×{" "}
                {data.rates.billableCores} assumed billable cores. Verify
                Rhino’s billable core count against your invoice.
              </p>
              <p>
                Metering begins with this deployment. User allocation is based
                on wall-clock processing time, including preparation and
                meshing. Shared runtime is the remainder of recorded uptime.
                These are estimates, not invoice totals; storage, requests,
                transfer, tax, Cognito and Vercel charges are excluded.
              </p>
              <p>
                Connection locations are approximate, based on Vercel’s IP
                geolocation. A VPN can change them. Latest 100 job events shown;
                the export includes this month’s user aggregates.
              </p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
