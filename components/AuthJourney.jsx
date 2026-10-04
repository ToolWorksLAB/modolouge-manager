"use client";
import { useEffect, useRef, useState, useId } from "react";
import { api } from "../lib/client-api.js";
import ParametricStudy from "./ParametricStudy.jsx";
const disciplines = [
  "Architecture",
  "Product design",
  "Engineering",
  "Art & exploration",
  "Learning",
  "Something else",
];
const startingPoints = [
  {
    title: "Bring my own definition",
    detail: "Turn a Grasshopper file into something you can explore.",
    icon: "file",
  },
  {
    title: "Play with the example",
    detail: "Start with a sphere. See how far a slider can take you.",
    icon: "shape",
  },
  {
    title: "Find my bearings",
    detail: "Get to know the workspace, one small experiment at a time.",
    icon: "compass",
  },
];
function Symbol({ kind }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      {kind === "file" ? (
        <>
          <path d="M6 3h8l4 4v14H6zM14 3v5h4" />
          <path d="m10 12-2 3 2 3m4-6 2 3-2 3" />
        </>
      ) : kind === "shape" ? (
        <>
          <ellipse cx="12" cy="12" rx="9" ry="5" />
          <ellipse cx="12" cy="12" rx="5" ry="9" />
          <circle cx="12" cy="12" r="9" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m15.5 8.5-2 5-5 2 2-5z" />
        </>
      )}
    </svg>
  );
}
export default function AuthJourney({
  manager = false,
  onComplete,
  onClose,
  onboarding = false,
  hasExploration = false,
  demo = false,
  initialStep = "email",
}) {
  // The isolated design preview creates no sessions and is excluded in production.
  const preview = process.env.NODE_ENV === "development" && demo;
  const [step, setStep] = useState(
    preview ? initialStep : onboarding ? "profile" : "email",
  );
  const [email, setEmail] = useState(
    manager ? "info@toolworkslab.com" : preview ? "you@studio.com" : "",
  );
  const [code, setCode] = useState(""),
    [name, setName] = useState(preview ? "Alex" : "");
  const [discipline, setDiscipline] = useState(""),
    [intent, setIntent] = useState(startingPoints[0].title);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [cooldown, setCooldown] = useState(0);
  const panel = useRef(null),
    heading = useRef(null),
    previousStep = useRef(step),
    dismiss = useRef(onClose);
  const fieldId = useId(),
    titleId = useId();
  dismiss.current = onClose;
  useEffect(() => {
    if (previousStep.current !== step) {
      heading.current?.focus();
      previousStep.current = step;
    }
  }, [step]);
  useEffect(() => {
    if (!onClose) return;
    const previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...panel.current.querySelectorAll(
          "a[href],button:not(:disabled),input:not(:disabled)",
        ),
      ].filter((n) => n.getClientRects().length);
    panel.current.querySelector("[data-initial-focus]")?.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        dismiss.current?.();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusable(),
        first = nodes[0],
        last = nodes.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === heading.current)
      ) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    const focus = (e) => {
      if (panel.current && !panel.current.contains(e.target))
        (
          panel.current.querySelector("[data-initial-focus]") || heading.current
        )?.focus();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("focusin", focus);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      document.removeEventListener("focusin", focus);
      previous?.focus?.();
    };
  }, [Boolean(onClose)]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function finish() {
    setBusy(true);
    setError("");
    try {
      if (onComplete) await onComplete({ intent });
      else window.location.assign("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!preview) await api("auth/send-code", { email });
      setCode("");
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
        const result = preview
          ? { onboarded: false }
          : await api("auth/verify-code", { code });
        if (result.onboarded || manager) await finish();
        else setStep("profile");
      } else if (step === "profile") setStep("intent");
      else {
        if (!preview)
          await api("auth/onboarding", { name, discipline, intent });
        setStep("ready");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const stage = ["email", "code"].includes(step) ? 0 : step === "ready" ? 2 : 1;
  const title = {
    email: manager
      ? "A clear view.\nFull control."
      : "Good ideas\nstart somewhere.",
    code: "Check your\ninbox.",
    profile: "A little about\nyou.",
    intent: "Where shall\nwe begin?",
    ready: `You’re in${name ? ", " + name : ""}.`,
  }[step];
  const description = {
    email: manager
      ? "Sign in with your ToolWorksLab email to manage activity, costs, and compute."
      : "A free space for your Grasshopper ideas. Make an account, keep experimenting, and see what takes shape.",
    code: "Your sign-in code is on its way to",
    profile:
      "Give your space a familiar name. A little context helps us welcome you.",
    intent: "Choose your first experiment. There’s no wrong starting point.",
    ready: hasExploration
      ? "Your definition, sliders, and geometry are right where you left them."
      : "Your workspace is ready. Let’s turn a little curiosity into something you can see.",
  }[step];
  return (
    <section
      ref={panel}
      className={"auth-journey journey-stage-" + step}
      aria-labelledby={titleId}
    >
      <aside className="journey-story">
        <a className="journey-wordmark" href="/" aria-label="Modolouge home">
          modolouge<span>by toolworkslab ↗</span>
        </a>
        <div className="journey-statement">
          <span className="journey-kicker">A SPACE FOR POSSIBILITIES</span>
          <h2>
            A little input.
            <br />A new
            <br /> <em>perspective.</em>
          </h2>
        </div>
        <ParametricStudy />
        <div className="journey-story-foot">
          <span>BUILT FOR CURIOUS MINDS</span>
          <span>MADE TO EXPLORE ↗</span>
        </div>
      </aside>
      <div className="journey-paper">
        <div className="journey-topline">
          <span>
            {manager ? "TOOLWORKSLAB / PRIVATE ACCESS" : "YOUR NEXT CHAPTER"}
          </span>
          {onClose ? (
            <button
              className="journey-close"
              onClick={onClose}
              aria-label="Close sign-in"
            >
              ×
            </button>
          ) : (
            <a
              className="journey-close"
              href="/"
              aria-label="Back to workspace"
            >
              ↗
            </a>
          )}
        </div>
        {!manager && (
          <ol className="journey-progress" aria-label="Account setup progress">
            {["Your email", "Make it yours", "Explore"].map((label, i) => (
              <li
                key={label}
                className={
                  i === stage ? "current" : i < stage ? "complete" : ""
                }
                aria-current={i === stage ? "step" : undefined}
              >
                <span className="journey-step-mark">
                  {i < stage ? "✓" : `0${i + 1}`}
                </span>
                <span>{label}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="journey-body" key={step}>
          <div className="journey-section-note">
            {step === "code"
              ? "ONE SMALL CHECK"
              : step === "ready"
                ? "HELLO, POSSIBILITY"
                : step === "profile"
                  ? "LET’S GET ACQUAINTED"
                  : step === "intent"
                    ? "YOUR FIRST EXPERIMENT"
                    : manager
                      ? "WELCOME BACK"
                      : "WELCOME TO MODOLOUGE"}
          </div>
          <h1 id={titleId} ref={heading} tabIndex={-1}>
            {title}
          </h1>
          <p className="journey-description">
            {description}
            {step === "code" && (
              <strong className="journey-email">{email}</strong>
            )}
          </p>
          {step === "ready" ? (
            <>
              <div className="journey-ready-card">
                <span className="journey-ready-check">✓</span>
                <div>
                  <strong>
                    {hasExploration
                      ? "Continue your exploration"
                      : intent || "Your first exploration"}
                  </strong>
                  <p>
                    {hasExploration
                      ? "Your work stays with you."
                      : startingPoints.find((p) => p.title === intent)
                          ?.detail || "Drop a definition and make it your own."}
                  </p>
                </div>
              </div>
              <div className="journey-allowance">
                <strong>60</strong>
                <span>
                  compute jobs a day
                  <br />
                  <small>Free account · includes file preparation</small>
                </span>
              </div>
              <button
                className="journey-primary"
                disabled={busy}
                onClick={finish}
              >
                {busy
                  ? "Opening your workspace…"
                  : hasExploration
                    ? "Back to my model"
                    : "Enter my workspace"}
                <span aria-hidden="true">↗</span>
              </button>
            </>
          ) : (
            <form onSubmit={submit} aria-busy={busy}>
              {step === "email" && (
                <>
                  <label className="journey-field" htmlFor={fieldId}>
                    Your email address
                    <input
                      id={fieldId}
                      data-initial-focus
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@studio.com"
                      aria-describedby={`${fieldId}-hint`}
                      disabled={busy}
                    />
                  </label>
                  <p className="journey-field-hint" id={`${fieldId}-hint`}>
                    We’ll send a code. No password to remember.
                  </p>
                </>
              )}
              {step === "code" && (
                <>
                  <label className="journey-field" htmlFor={fieldId}>
                    Your 8-digit code
                    <input
                      id={fieldId}
                      data-initial-focus
                      className="journey-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{8}"
                      minLength={8}
                      maxLength={8}
                      required
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                      }
                      placeholder="00000000"
                      disabled={busy}
                      aria-describedby={`${fieldId}-hint`}
                    />
                  </label>
                  <p className="journey-field-hint" id={`${fieldId}-hint`}>
                    Valid for 10 minutes. Check your spam folder, too.
                  </p>
                </>
              )}
              {step === "profile" && (
                <>
                  <label className="journey-field" htmlFor={fieldId}>
                    What should we call you?
                    <input
                      id={fieldId}
                      data-initial-focus
                      name="name"
                      autoComplete="given-name"
                      required
                      maxLength={80}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your first name"
                      disabled={busy}
                    />
                  </label>
                  <fieldset className="journey-choices">
                    <legend>
                      Your area of work <span>Optional</span>
                    </legend>
                    <div>
                      {disciplines.map((d) => (
                        <button
                          type="button"
                          key={d}
                          aria-pressed={discipline === d}
                          onClick={() =>
                            setDiscipline(d === discipline ? "" : d)
                          }
                          className={discipline === d ? "selected" : ""}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </>
              )}
              {step === "intent" && (
                <fieldset className="journey-intents">
                  <legend className="visually-hidden">
                    Your preferred starting point
                  </legend>
                  {startingPoints.map((p) => (
                    <button
                      type="button"
                      key={p.title}
                      aria-pressed={intent === p.title}
                      onClick={() => setIntent(p.title)}
                      className={intent === p.title ? "selected" : ""}
                    >
                      <span className="intent-symbol">
                        <Symbol kind={p.icon} />
                      </span>
                      <span>
                        <strong>{p.title}</strong>
                        <small>{p.detail}</small>
                      </span>
                      <span className="intent-radio" aria-hidden="true" />
                    </button>
                  ))}
                </fieldset>
              )}
              {error && (
                <p className="journey-error" role="alert">
                  {error}
                </p>
              )}
              <button className="journey-primary" disabled={busy}>
                {busy ? (
                  <>
                    <span className="journey-spinner" />
                    One moment…
                  </>
                ) : step === "email" ? (
                  "Continue with email"
                ) : step === "code" ? (
                  "Verify my email"
                ) : step === "profile" ? (
                  "Continue"
                ) : (
                  "Make it mine"
                )}
                <span aria-hidden="true">↗</span>
              </button>
              {step === "email" && (
                <p className="journey-returning">
                  {manager
                    ? "Restricted to the ToolWorksLab administrator."
                    : "Already been here? Use the same email to sign in."}
                </p>
              )}
              {step === "code" && (
                <div className="journey-secondary">
                  <button
                    type="button"
                    disabled={busy || cooldown > 0}
                    onClick={send}
                  >
                    {cooldown > 0
                      ? `Send again in ${cooldown}s`
                      : "Send a new code"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setStep("email");
                      setCode("");
                      setError("");
                    }}
                  >
                    Change email
                  </button>
                </div>
              )}
              {step === "intent" && (
                <button
                  className="journey-back"
                  type="button"
                  disabled={busy}
                  onClick={() => setStep("profile")}
                >
                  ← Back to your details
                </button>
              )}
            </form>
          )}
          {step === "ready" && error && (
            <p className="journey-error" role="alert">
              {error}
            </p>
          )}
          {step === "email" && !manager && (
            <div className="journey-benefits">
              <span>
                <b>60</b> jobs a day
              </span>
              <span>
                <b>0</b> payment details
              </span>
            </div>
          )}
        </div>
        <div className="journey-footer">
          <span>
            {hasExploration
              ? "Your exploration stays right here."
              : "Made for exploring. Built with care."}
          </span>
          <a href="/privacy">Privacy ↗</a>
        </div>
      </div>
    </section>
  );
}
