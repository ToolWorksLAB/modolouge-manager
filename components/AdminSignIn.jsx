"use client";
import { useState } from "react";
import { api } from "../lib/client-api.js";
export default function AdminSignIn() {
  const [step, setStep] = useState("login");
  const [email, setEmail] = useState("info@toolworkslab.com");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function move(next) {
    setStep(next); setError(""); setMessage(""); setPassword(""); setConfirmation(""); setCode("");
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (step === "login") {
        await api("auth/password-login", { email, password });
        window.location.assign("/");
      } else if (step === "recovery") {
        await api("auth/send-code", { email, purpose: "password-recovery" });
        move("code");
      } else if (step === "code") {
        await api("auth/verify-code", { code });
        move("password");
      } else {
        if (password !== confirmation) throw new Error("The passwords do not match.");
        await api("auth/reset-password", { password });
        move("login");
        setMessage("Password saved. Sign in with your new password.");
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  return <section className="auth-journey" aria-labelledby="admin-login-title">
    <aside className="journey-story">
      <a className="journey-wordmark" href="/">toolworkslab<span>Admin ↗</span></a>
      <div className="journey-statement"><span className="journey-kicker">YOUR OPERATIONS</span><h2>A clear view.<br/>Full <em>control.</em></h2></div>
      <div className="journey-story-foot"><span>TOOLWORKSLAB</span><span>PRIVATE ACCESS</span></div>
    </aside>
    <div className="journey-paper">
      <div className="journey-topline"><span>TOOLWORKSLAB / PRIVATE ACCESS</span></div>
      <div className="journey-body">
        <div className="journey-section-note">{step === "login" ? "WELCOME BACK" : "PASSWORD RECOVERY"}</div>
        <h1 id="admin-login-title">{{login:"Sign in.", recovery:"Set or recover\nyour password.", code:"Check your\ninbox.", password:"Choose your\npassword."}[step]}</h1>
        <p className="journey-description">{{login:"Use your admin email and password. You’ll stay signed in on this browser.",recovery:"We’ll email a verification code to confirm it’s you. Use this once to set your password, or whenever you need to recover it.",code:`Enter the newest code sent to ${email}. Keep this browser tab open.`,password:"Use a unique password of at least 12 characters. Saving it signs out existing admin sessions."}[step]}</p>
        <form onSubmit={submit} aria-busy={busy}>
          {(step === "login" || step === "recovery") && <label className="journey-field" htmlFor="admin-email">Admin email
            <input id="admin-email" name="email" type="email" autoComplete="username" required maxLength={254} value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/>
          </label>}
          {(step === "login" || step === "password") && <label className="journey-field" htmlFor="admin-password">{step === "login" ? "Password" : "New password"}
            <input id="admin-password" name="password" type="password" autoComplete={step === "login" ? "current-password" : "new-password"} required minLength={step === "password" ? 12 : undefined} maxLength={step === "password" ? 128 : 1024} value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/>
          </label>}
          {step === "password" && <label className="journey-field" htmlFor="admin-confirmation">Confirm password
            <input id="admin-confirmation" name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmation} disabled={busy} onChange={e=>setConfirmation(e.target.value)}/>
          </label>}
          {step === "code" && <label className="journey-field" htmlFor="admin-code">Email verification code
            <input id="admin-code" name="code" className="journey-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required minLength={6} maxLength={10} value={code} disabled={busy} onChange={e=>setCode(e.target.value.replace(/\D/g,"").slice(0,10))}/>
          </label>}
          {error && <p className="journey-error" role="alert">{error}</p>}
          {message && <p className="journey-field-hint" role="status">{message}</p>}
          <button className="journey-primary" disabled={busy}>{busy ? "One moment…" : {login:"Sign in",recovery:"Send verification code",code:"Verify code",password:"Save password"}[step]}<span aria-hidden="true">↗</span></button>
          <div className="journey-secondary">
            <button type="button" disabled={busy} onClick={()=>move(step === "login" ? "recovery" : "login")}>{step === "login" ? "Set or recover password" : "Back to sign in"}</button>
            {step === "code" && <button type="button" disabled={busy} onClick={()=>move("recovery")}>Request a new code</button>}
          </div>
        </form>
      </div>
      <div className="journey-footer"><span>Restricted to the ToolWorksLab administrator.</span><a href="/privacy">Privacy ↗</a></div>
    </div>
  </section>;
}
