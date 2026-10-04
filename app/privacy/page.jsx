export default function Privacy() {
  return (
    <main className="document">
      <a href="/">← Back to Modolouge</a>
      <div className="eyebrow">TOOLWORKSLAB / SERVICE DETAILS</div>
      <h1>Built with care.</h1>
      <h2>Accounts and usage</h2>
      <p>
        ToolWorksLab uses Supabase in Stockholm for accounts, onboarding and
        service activity. You can try the workspace before creating an account.
        We record a secure guest session identifier, your connection IP address,
        job timestamps, duration, outcome, and approximate country, region and
        city provided by Vercel. These locations can be inaccurate, especially
        with a VPN. We do not request GPS location. Full IP addresses are
        visible only to the administrator for service monitoring and abuse
        prevention, and are automatically removed after 30 days. We also retain
        a keyed hash of the IP for the trial allowance during that period. An IP
        can identify a shared network or VPN, rather than an individual person.
      </p>
      <h2>Your definitions</h2>
      <p>
        Files and preview results are stored privately in AWS Stockholm. Upload
        and download links expire after two minutes. Definitions expire after 24
        hours; storage lifecycle cleanup can take longer. We do not train models
        on your files. Avoid uploading confidential client work unless you have
        permission.
      </p>
      <h2>Public execution policy</h2>
      <p>
        Only explicitly reviewed built-in geometry, arithmetic and parameter
        component IDs are accepted. Scripts, clusters, file/network components
        and unknown plugins are rejected before Compute receives a definition.
        This is a compatibility restriction, not a promise that every
        Grasshopper file will run. A file may still exceed the compute time or
        preview limits.
      </p>
      <h2>Usage limits</h2>
      <p>
        Guests can make five geometry runs before verifying their email.
        Preparing a definition does not use a geometry run, but is limited to
        five preparations and five file uploads. Trial limits apply to your
        browser and network for 30 days, including after clearing cookies. Each
        verified account has 60 jobs per UTC day, with one outstanding job at a
        time. Preparing a definition and running the example also count. The
        whole service has a shared limit of 600 jobs per day. Jobs time out
        after three minutes. The administrator may block abusive accounts or
        stop the service.
      </p>
      <h2>Cost estimates and retention</h2>
      <p>
        The manager estimates USD costs from recorded job time and configured
        AWS and Rhino hourly rates. Shared idle runtime, storage, taxes, data
        transfer, authentication and Vercel charges are not exact per-user
        invoice amounts. Usage events are retained for 90 days, aggregate usage
        for 13 months, and account data until deletion is requested.
        Infrastructure providers may retain operational logs under their own
        policies.
      </p>
      <h2>Contact</h2>
      <p>
        For access, deletion or privacy requests, contact{" "}
        <a href="mailto:info@toolworkslab.com">info@toolworkslab.com</a>.
      </p>
    </main>
  );
}
