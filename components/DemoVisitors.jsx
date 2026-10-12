"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/client-api.js";
const time = n => n >= 3600 ? (n / 3600).toFixed(1) + " h" : n >= 60 ? Math.floor(n / 60) + "m " + n % 60 + "s" : n + "s";
const label = value => String(value).replaceAll("_", " ");
const date = value => new Date(value).toLocaleString();
function Breakdown({ title, rows }) {
  const max = Math.max(1, ...rows.map(row => Number(row.visits || row.count)));
  return <article className="visitor-breakdown"><h3>{title}</h3>{rows.length ? rows.map(row => <div key={row.label}><span>{label(row.label)}</span><b>{Number(row.visits || row.count).toLocaleString()}</b><i style={{ width: Math.max(2, Number(row.visits || row.count) / max * 100) + "%" }} /></div>) : <p className="fine">No visits recorded yet.</p>}</article>;
}
export default function DemoVisitors() {
  const [days, setDays] = useState(7), [offset, setOffset] = useState(0), [data, setData] = useState(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true, pending = false;
    setData(null);
    async function refresh() {
      if (pending || document.hidden) return;
      pending = true;
      try { const next = await api("admin/demo-visitors?days=" + days + "&offset=" + offset); if (active) { setData(next); setError(""); } }
      catch (e) { if (active) setError(e.message); }
      finally { pending = false; }
    }
    refresh();
    const timer = setInterval(refresh, 20000);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [days, offset, revision]);
  return <section className="demo-visitors" id="demo-visitors" aria-labelledby="demo-visitors-title">
    <div className="data-heading"><div><span className="eyebrow">DEMO.TOOLWORKSLAB.COM / AUDIENCE</span><h2 id="demo-visitors-title">Demo visitors.</h2><p>See where the interest comes from · updates every 20 seconds</p></div>
      <div className="visitor-filters"><label>Period <select aria-label="Demo analytics period" value={days} onChange={e => { setDays(Number(e.target.value)); setOffset(0); }}>{[1,7,30,90].map(n=><option key={n} value={n}>Last {n === 1 ? "24 hours" : n + " days"}</option>)}</select></label><button className="button quiet" onClick={()=>setRevision(n=>n+1)}>Refresh visits ↻</button></div></div>
    <p className="visitor-note">Only visitors who allow analytics are included. Each page visit is a separate session, not a uniquely identified person. Engaged time excludes hidden tabs and pauses after 60 seconds without interaction. Locations are approximate; network addresses are masked. Records expire after 90 days.</p>
    {error && <p role="alert" className="notice error">{error}</p>}
    {!data ? <div className="loading-card">{error ? "Visitor data could not be loaded. Refresh to retry." : "Reading demo visits…"}</div> : <>
      <div className="metrics">
        <article><span className="eyebrow">VISITS</span><strong>{data.summary.visits.toLocaleString()}</strong><p>{data.summary.engaged_visits} stayed at least 10 seconds</p></article>
        <article><span className="eyebrow">ACTIVE NOW</span><strong>{data.summary.active_now}</strong><p>Engagement reported within 75 seconds</p></article>
        <article><span className="eyebrow">AVERAGE ENGAGED TIME</span><strong>{time(data.summary.average_seconds)}</strong><p>{time(data.summary.active_seconds)} combined attention</p></article>
        <article><span className="eyebrow">COUNTRIES</span><strong>{data.summary.countries}</strong><p>Approximate connection locations</p></article>
      </div>
      <div className="visitor-charts"><Breakdown title="Countries" rows={data.countries} /><Breakdown title="Devices" rows={data.devices} /><Breakdown title="Browsers" rows={data.browsers} /><Breakdown title="Tools & actions" rows={data.actions} /></div>
      <div className="visitor-days" aria-label="Daily visits in UTC">{data.daily.map(day=><span key={day.day}><small>{day.day.slice(5)}</small><b>{day.visits}</b><span>{time(day.active_seconds)}</span></span>)}</div>
      <div className="table-scroll"><table><thead><tr><th>Visit / time</th><th>Location / network</th><th>Device</th><th>Engaged time</th><th>Last tool</th><th>Source</th></tr></thead><tbody>
        {data.visits.map(visit=><tr key={visit.id}><td><strong>Visitor {visit.id.slice(0,8)}</strong><small>{date(visit.created_at)}</small><span className={"tag " + (visit.active_now ? "visitor-live" : "")}>{visit.active_now ? "Active now" : visit.ended ? "Visit ended" : "Inactive"}</span></td><td>{[visit.city,visit.region,visit.country].filter(Boolean).join(", ")}<small>{visit.masked_ip || "Network unavailable"}</small></td><td>{visit.device}<small>{visit.os} · {visit.browser}</small></td><td>{time(visit.active_seconds)}<small>Last seen {date(visit.last_seen)}</small></td><td>{label(visit.section)}<small>{Object.entries(visit.events).filter(([,n])=>n>0).map(([key,n])=>label(key)+": "+n).join(" · ") || "Exploring"}</small></td><td>{visit.referrer || "Direct / unavailable"}</td></tr>)}
        {!data.visits.length && <tr><td colSpan="6" className="empty-table">No consenting demo visitors in this period yet. Tracking starts with this release; earlier visits cannot be recovered.</td></tr>}
      </tbody></table></div>
      <div className="visitor-pagination"><span>{data.summary.visits ? offset+1 : 0}–{offset+data.visits.length} of {data.summary.visits} visits · Updated {date(data.updated_at)}</span><div><button className="button quiet" disabled={!offset} onClick={()=>setOffset(n=>Math.max(0,n-50))}>← Previous</button><button className="button quiet" disabled={offset+50>=data.summary.visits} onClick={()=>setOffset(n=>n+50)}>Next →</button></div></div>
    </>}
  </section>;
}
