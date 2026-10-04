"use client";
import { useEffect, useState, useRef } from "react";
import { api } from "./Workspace.jsx";
export default function AuthJourney({
  manager = false,
  onComplete,
  onClose,
  onboarding = false,
}) {
  const panel = useRef(null);
  useEffect(() => {
    if (!onClose) return;
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = [
        ...panel.current.querySelectorAll(
          "button:not(:disabled),a,input:not(:disabled)",
        ),
      ];
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus?.();
    };
  }, [onClose]);
  const [step, setStep] = useState(onboarding ? "profile" : "email"),
    [email, setEmail] = useState(manager ? "info@toolworkslab.com" : ""),
    [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [discipline, setDiscipline] = useState("Architecture"),
    [intent, setIntent] = useState("Explore a definition"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function finish() {
    if (onComplete) await onComplete();
    else window.location.assign("/");
  }
  async function send() {
    setBusy(true);
    setError("");
    try {
      await api("auth/send-code", { email });
      setStep("code");
      setCooldown(60);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (step === "email") return send();
    setBusy(true);
    setError("");
    try {
      if (step === "code") {
        const result = await api("auth/verify-code", { code });
        if (result.onboarded || manager) await finish();
        else setStep("profile");
      } else if (step === "profile") setStep("intent");
      else {
        await api("auth/onboarding", { name, discipline, intent });
        setStep("ready");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const title = {
    email: manager ? "Your service. Your control." : "Keep your ideas moving.",
    code: "A small check. Then you’re in.",
    profile: "Make yourself at home.",
    intent: "What brings you here?",
    ready: "You’re ready to explore.",
  }[step];
  return (
    <section ref={panel} className="auth-journey" aria-label="Account setup">
      <div className="auth-top">
        <span className="eyebrow">
          TOOLWORKSLAB / {manager ? "MANAGER" : "YOUR NEXT CHAPTER"}
        </span>
        {onClose && (
          <button
            className="quiet"
            onClick={onClose}
            aria-label="Close sign-in"
          >
            ✕
          </button>
        )}
      </div>
      <div className="journey-progress" aria-label="Setup progress">
        {["Verify email", "Make it yours", "Start exploring"].map((s, i) => (
          <span
            key={s}
            className={
              (step === "email" || step === "code"
                ? 0
                : step === "ready"
                  ? 2
                  : 1) >= i
                ? "active"
                : ""
            }
          >
            <b>0{i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      <h1>{title}</h1>
      <p className="lead">
        {step === "email"
          ? manager
            ? "Secure access for the ToolWorksLab administrator."
            : "Five runs are just the beginning. Create your free account for 60 jobs a day. Your current exploration stays right here."
          : step === "code"
            ? `We sent a sign-in code to ${email}. Enter it below to verify your address.`
            : step === "profile"
              ? "A name and a little context. The rest is yours to discover."
              : step === "intent"
                ? "We’ll point you toward a useful first step. You can always try something different."
                : "Drop your definition, adjust a slider, and see what happens next."}
      </p>
      {step === "ready" ? (
        <div className="welcome-ready">
          <span className="ready-mark">↗</span>
          <p>Welcome, {name}. Your free account is ready.</p>
          <button className="button primary" onClick={finish}>
            Enter your workspace <span>↗</span>
          </button>
        </div>
      ) : (
        <form onSubmit={submit}>
          {step === "email" && (
            <label className="form-field">
              Email address
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@studio.com"
                autoFocus
              />
            </label>
          )}
          {step === "code" && (
            <>
              <label className="form-field">
                Your verification code
                <input
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9 ]{6,12}"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="code-input"
                  placeholder="00000000"
                  autoFocus
                />
              </label>
              <div className="auth-secondary">
                <button
                  type="button"
                  className="text-link"
                  disabled={busy || cooldown > 0}
                  onClick={send}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Send a new code"}
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError("");
                  }}
                >
                  Change email
                </button>
              </div>
              <p className="fine">
                Check your spam folder too. Use the most recent email; codes
                expire after 10 minutes.
              </p>
            </>
          )}
          {step === "profile" && (
            <>
              <label className="form-field">
                What should we call you?
                <input
                  name="name"
                  autoComplete="given-name"
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoFocus
                />
              </label>
              <fieldset className="choice-field">
                <legend>Your area of work</legend>
                <div className="choice-grid">
                  {[
                    "Architecture",
                    "Product design",
                    "Engineering",
                    "Art & exploration",
                    "Learning",
                    "Something else",
                  ].map((v) => (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={discipline === v}
                      className={
                        discipline === v ? "choice selected" : "choice"
                      }
                      onClick={() => setDiscipline(v)}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          {step === "intent" && (
            <fieldset className="choice-field">
              <legend>Choose a starting point</legend>
              <div className="intent-choices">
                {[
                  [
                    "Explore a definition",
                    "Bring a Grasshopper file and see it take shape.",
                  ],
                  [
                    "Experiment with parameters",
                    "Start with the sphere and learn by changing it.",
                  ],
                  [
                    "Share a workflow",
                    "Explore what a browser-based definition can do.",
                  ],
                ].map(([v, d]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={intent === v}
                    className={intent === v ? "choice selected" : "choice"}
                    onClick={() => setIntent(v)}
                  >
                    <strong>{v}</strong>
                    <span>{d}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary auth-submit" disabled={busy}>
            {busy
              ? "One moment…"
              : step === "email"
                ? "Send my sign-in code"
                : step === "code"
                  ? "Verify & continue"
                  : step === "profile"
                    ? "Continue"
                    : "Make it mine"}
            <span>↗</span>
          </button>
          {step === "intent" && (
            <button
              type="button"
              className="quiet"
              onClick={() => setStep("profile")}
            >
              Back
            </button>
          )}
        </form>
      )}
      <p className="fine">
        No password to remember. We use your email for secure access.{" "}
        <a href="/privacy">Privacy & service details</a>
      </p>
    </section>
  );
}
