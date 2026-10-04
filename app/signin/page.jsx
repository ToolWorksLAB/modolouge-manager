import AuthJourney from "../../components/AuthJourney.jsx";
import { manager } from "../../lib/config.js";
export default function SignIn() {
  return (
    <main className="auth-page">
      <a className="brand" href="/">
        toolworkslab<span className="pink"> ↗</span>
      </a>
      <AuthJourney manager={manager} />
      <a className="text-link" href="/">
        ← Back to {manager ? "manager" : "your exploration"}
      </a>
    </main>
  );
}
