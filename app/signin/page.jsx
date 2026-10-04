import AuthJourney from "../../components/AuthJourney.jsx";
import { manager } from "../../lib/config.js";
export default function SignIn() {
  return (
    <main className="auth-page">
      <AuthJourney manager={manager} />
      <a className="journey-outside-link" href="/">
        ← Back to {manager ? "manager" : "your exploration"}
      </a>
    </main>
  );
}
