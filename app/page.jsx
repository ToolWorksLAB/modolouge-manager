import { session, requireUser } from "../lib/auth.js";
import { manager } from "../lib/config.js";
import Workspace from "../components/Workspace.jsx";
import Manager from "../components/Manager.jsx";
export const dynamic = "force-dynamic";
export default async function Page() {
  let user = null,
    message = "";
  try {
    if (await session()) user = await requireUser(manager);
  } catch (e) {
    message = e.status ? e.message : "Sign-in is temporarily unavailable.";
  }
  return (
    <>
      <header className="topbar">
        <a
          className="brand"
          href="https://toolworkslab.com"
          target="_blank"
          rel="noreferrer"
        >
          toolworkslab<span className="brand-mark">↗</span>
        </a>
        <nav className="pill-nav">
          <span className="selected">{manager ? "Manager" : "Workspace"}</span>
          <a
            href={
              manager
                ? "https://modolouge.vercel.app"
                : "https://modolouge-manager.vercel.app"
            }
          >
            {manager ? "Workspace" : "Manager"} ↗
          </a>
        </nav>
        <div className="account">
          {user ? (
            <>
              <span>{user.email}</span>
              <form action="/api/auth/logout" method="post">
                <button className="quiet">Sign out</button>
              </form>
            </>
          ) : (
            <a className="button quiet" href="/api/auth/login">
              Sign in ↗
            </a>
          )}
        </div>
      </header>
      {user ? (
        manager ? (
          <Manager />
        ) : (
          <Workspace email={user.email} />
        )
      ) : (
        <main className="landing">
          <div className="eyebrow">
            TOOLWORKSLAB /{" "}
            {manager ? "SERVICE OPERATIONS" : "PARAMETRIC WORKSPACE"} / 01
          </div>
          <div className="hero-grid">
            <div>
              <h1>
                {manager ? (
                  <>
                    A clear view.
                    <br />
                    Full control<span className="pink">.</span>
                  </>
                ) : (
                  <>
                    Your definition.
                    <br />A new dimension<span className="pink">.</span>
                  </>
                )}
              </h1>
              <p className="lead">
                {manager
                  ? "See who is building, understand service costs, and control when compute runs. One considered place for the whole service."
                  : "Drop a Grasshopper file. Shape it with live sliders. Explore the geometry, right here in your browser."}
              </p>
              <div className="hero-actions">
                <a className="button primary" href="/api/auth/login">
                  {manager ? "Open manager" : "Enter the workspace"}{" "}
                  <span>↗</span>
                </a>
                {!manager && (
                  <a className="text-link" href="/api/auth/login?signup=1">
                    Create an account
                  </a>
                )}
              </div>
              {message && <p className="notice error">{message}</p>}
              <p className="fine">
                {manager
                  ? "Administrator access · info@toolworkslab.com"
                  : "Verified email required · .gh & .ghx · 20 MB per definition"}
              </p>
            </div>
            <div className="generative" aria-hidden="true">
              {Array.from({ length: 19 }, (_, i) => (
                <i key={i} style={{ "--i": i }} />
              ))}
              <div className="art-label">
                {manager
                  ? "OBSERVE / UNDERSTAND / CONTROL"
                  : "INPUT / ITERATE / EXPLORE"}
              </div>
            </div>
          </div>
          <section className="intro-cards">
            {(manager
              ? [
                  "Real usage, in view",
                  "Costs with context",
                  "Compute on your terms",
                ]
              : ["Bring your logic", "Make it tangible", "Keep exploring"]
            ).map((t, i) => (
              <article key={t}>
                <span className="eyebrow">0{i + 1}</span>
                <h2>{t}</h2>
                <p>
                  {
                    (manager
                      ? [
                          "Verified users, job history, and approximate connection locations.",
                          "Measured job time, shared runtime, and clearly labeled estimates.",
                          "Stop the Linux server. Start it again from this independent panel.",
                        ]
                      : [
                          "Drop a supported Grasshopper definition. Sliders and toggles appear automatically.",
                          "A real Rhino.Compute solve, a shaded viewport, and controls that stay connected.",
                          "Orbit, inspect, change a value, and solve again. Start with the included sphere.",
                        ])[i]
                  }
                </p>
              </article>
            ))}
          </section>
          <p className="fine legal">
            {manager
              ? "Stopping EC2 removes compute charges while it is stopped. Retained storage and other platform services may still be billed."
              : "Public service: reviewed geometry components only. Scripts, clusters, file access, and unreviewed plugins are rejected. 60 jobs per account per UTC day; shared daily limit applies."}{" "}
            <a href="/privacy">Privacy & service details ↗</a>
          </p>
        </main>
      )}
      <footer>
        <span>modolouge{manager ? " / manager" : ""}</span>
        <span>A TOOLWORKSLAB EXPERIMENT</span>
        <a href="/privacy">Privacy & service details</a>
      </footer>
    </>
  );
}
