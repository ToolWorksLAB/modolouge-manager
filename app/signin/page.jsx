import AuthJourney from "../../components/AuthJourney.jsx";
import AdminSignIn from "../../components/AdminSignIn.jsx";
import { manager } from "../../lib/config.js";
export default async function SignIn({ searchParams }) {
  const expired = (await searchParams)?.reason === "session-expired";
  return (
    <main className="auth-page">
      {manager ? <AdminSignIn expired={expired} /> : <AuthJourney />}
      <a className="journey-outside-link" href="/">
        ← Back to {manager ? "manager" : "your exploration"}
      </a>
    </main>
  );
}
