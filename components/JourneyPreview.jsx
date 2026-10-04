"use client";
import { useState } from "react";
import AuthJourney from "./AuthJourney.jsx";
export default function JourneyPreview() {
  const [screen, setScreen] = useState("email"),
    [version, setVersion] = useState(0),
    [manager, setManager] = useState(false);
  return (
    <main className="auth-page design-preview">
      <div className="preview-toolbar">
        <span>DESIGN PREVIEW · no emails or accounts created</span>
        <nav aria-label="Preview onboarding screens">
          {["email", "code", "profile", "intent", "ready"].map((s) => (
            <button
              key={s}
              aria-pressed={screen === s}
              onClick={() => {
                setScreen(s);
                setVersion((v) => v + 1);
              }}
            >
              {s}
            </button>
          ))}
          <button
            aria-pressed={manager}
            onClick={() => {
              setManager((m) => !m);
              setScreen("email");
              setVersion((v) => v + 1);
            }}
          >
            Manager
          </button>
        </nav>
      </div>
      <AuthJourney
        key={version}
        demo
        initialStep={screen}
        manager={manager}
        onComplete={() => {
          setScreen("email");
          setVersion((v) => v + 1);
        }}
      />
    </main>
  );
}
