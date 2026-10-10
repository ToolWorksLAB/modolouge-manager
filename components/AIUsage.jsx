"use client";
import { useState, useEffect } from "react";
import { api } from "../lib/client-api.js";
const usd = (n) => "$" + Number(n || 0).toFixed(4),
  number = (n) => Number(n || 0).toLocaleString();
export default function AIUsage() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [budget, setBudget] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    try {
      const d = await api("admin/ai");
      setData(d);
      setBudget((b) => (b === "" ? String(d.settings.daily_budget_usd) : b));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20000);
    return () => clearInterval(t);
  }, []);
  async function save(enabled) {
    setBusy(true);
    try {
      await api("admin/ai", { enabled, daily_budget_usd: Number(budget) });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const total = (key) =>
    data?.summary.reduce((sum, x) => sum + Number(x[key] || 0), 0) || 0;
  return (
    <section className="ai-usage-panel">
      <div className="ai-usage-heading">
        <div>
          <span className="eyebrow">APP BUILDER / AI USAGE</span>
          <h2>The cost of an idea.</h2>
          <p>GPT-5.4 mini · node and connection analysis · this UTC month</p>
        </div>
        <button className="quiet" onClick={refresh}>
          Refresh AI usage
        </button>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {data && (
        <>
          <div className="metrics">
            <article>
              <span className="eyebrow">AI REQUESTS</span>
              <strong>{number(total("requests"))}</strong>
              <p>{number(total("failed"))} failed requests</p>
            </article>
            <article>
              <span className="eyebrow">INPUT / OUTPUT TOKENS</span>
              <strong className="ai-token-number">
                {number(total("input_tokens"))} /{" "}
                {number(total("output_tokens"))}
              </strong>
              <p>
                {number(total("cache_tokens"))} cached ·{" "}
                {number(total("reasoning_tokens"))} reasoning
              </p>
            </article>
            <article>
              <span className="eyebrow">GATEWAY REPORTED COST</span>
              <strong>{usd(total("reported_cost_usd"))}</strong>
              <p>Confirmed costs returned by the AI Gateway</p>
            </article>
            <article>
              <span className="eyebrow">ESTIMATED / UNRESOLVED</span>
              <strong>{usd(total("estimated_cost_usd"))}</strong>
              <p>
                + {usd(total("unresolved_reserve_usd"))} reserved for incomplete
                usage
              </p>
            </article>
          </div>
          <div className="ai-budget">
            <span
              className={"status " + (data.settings.enabled ? "online" : "")}
            >
              <i />
              {data.settings.enabled
                ? "AI drafting enabled"
                : "AI drafting paused"}
            </span>
            <label>
              Daily AI cap (USD)
              <input
                aria-label="Daily AI budget in USD"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
              />
            </label>
            <button
              className="button quiet"
              disabled={busy || budget === ""}
              onClick={() => save(data.settings.enabled)}
            >
              Save cap
            </button>
            <button
              className="button primary"
              disabled={busy || budget === ""}
              onClick={() => save(!data.settings.enabled)}
            >
              {data.settings.enabled
                ? "Pause AI drafting"
                : "Enable AI drafting"}
            </button>
          </div>
          <p className="fine">
            The cap uses reported costs, estimates and a $0.30 reservation per
            in-flight request. Pausing blocks new generations; a request already
            running may finish. Reasoning tokens are included in output tokens,
            not added again. This panel excludes geometry and hosting costs.
          </p>
          <details className="ai-usage-details" open>
            <summary>Usage by person</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Requests</th>
                    <th>Input / output</th>
                    <th>Reported USD</th>
                    <th>Estimated USD</th>
                    <th>Last IP / approximate location</th>
                  </tr>
                </thead>
                <tbody>
                  {data.summary.map((s) => (
                    <tr key={s.actor_id}>
                      <td>{s.email}</td>
                      <td>{number(s.requests)}</td>
                      <td>
                        {number(s.input_tokens)} / {number(s.output_tokens)}
                      </td>
                      <td>{usd(s.reported_cost_usd)}</td>
                      <td>{usd(s.estimated_cost_usd)}</td>
                      <td>
                        {s.ip || "—"}
                        <br />
                        {[s.location?.city, s.location?.country]
                          .filter(Boolean)
                          .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.summary.length && (
                <p>No AI generation has been recorded yet.</p>
              )}
            </div>
          </details>
          <details className="ai-usage-details">
            <summary>Latest 100 model requests</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Time / person</th>
                    <th>Model</th>
                    <th>Status</th>
                    <th>Input / output</th>
                    <th>Cost USD</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {data.events.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {new Date(e.created_at).toLocaleString()}
                        <br />
                        {e.email}
                        <small>
                          {e.ip || "IP expired / unavailable"} ·{" "}
                          {[e.location?.city, e.location?.country]
                            .filter(Boolean)
                            .join(", ")}
                        </small>
                      </td>
                      <td>{e.model}</td>
                      <td>
                        {e.status}
                        {e.error_code ? <small> / {e.error_code}</small> : null}
                      </td>
                      <td>
                        {number(e.input_tokens)} / {number(e.output_tokens)}
                      </td>
                      <td>
                        {e.cost_usd === null
                          ? `${usd(e.estimate_usd)} estimated`
                          : usd(e.cost_usd)}
                        {e.cost_usd === null && Number(e.reserved_usd) > 0 ? (
                          <small> / reserved {usd(e.reserved_usd)}</small>
                        ) : null}
                      </td>
                      <td>
                        {e.latency_ms
                          ? (e.latency_ms / 1000).toFixed(1) + " s"
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
