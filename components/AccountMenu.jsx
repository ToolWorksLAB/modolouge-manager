"use client";
import { useEffect, useState } from "react";
export default function AccountMenu({ initialEmail, manager }) {
  const [email, setEmail] = useState(initialEmail || "");
  useEffect(() => {
    const changed = (e) => setEmail(e.detail?.email || "");
    window.addEventListener("modolouge-auth", changed);
    return () => window.removeEventListener("modolouge-auth", changed);
  }, []);
  return (
    <div className="account">
      {email ? (
        <>
          <span>{email}</span>
          <form action="/api/auth/logout" method="post">
            <button className="quiet">Sign out</button>
          </form>
        </>
      ) : manager ? (
        <a className="button quiet" href="/signin">
          Sign in ↗
        </a>
      ) : (
        <button
          className="button quiet"
          onClick={() => window.dispatchEvent(new Event("modolouge-signin"))}
        >
          Sign in ↗
        </button>
      )}
    </div>
  );
}
