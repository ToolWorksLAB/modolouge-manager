# Modolouge Manager

ToolWorksLab's independent administration panel for Modolouge, using the company's graphite, cream and magenta design system.

Only a Supabase-verified `info@toolworkslab.com` account can use this panel. Every admin API request checks the encrypted session, current account state and administrator email. Mutations require a matching Origin. Ordinary verified accounts cannot read this dashboard or control EC2.

The dashboard shows accounts, approximate country/city, last activity, job counts, durations, failures, cost estimates, shared runtime and administrative history. Usage exports to CSV. Blocking takes effect for existing sessions and queued jobs.

Start/stop targets only Linux EC2 `i-0c6e3386ff6d66b5b` in `eu-north-1`. The public-app role cannot stop it; the manager cannot control preserved Windows instances. The manager remains online when compute stops. Stopping disables submissions and stops EC2; retained storage and other services can still cost money.

## Deployment

GitHub: `ToolWorksLAB/modolouge-manager`, production branch `main`. Intended company Vercel team: `team_D2suiiZSHHspd8E4WqQuvMeY` / `info-85726815s-projects`. Never use the Plantar3D client workspace.

The owner authorized making this repository public. It is connected to the company Vercel Hobby workspace; pushes to `main` deploy production at [admin.toolworkslab.com](https://admin.toolworkslab.com). The public workspace is [modolouge.toolworkslab.com](https://modolouge.toolworkslab.com). The previous Vercel addresses redirect to these canonical domains. The Vercel subscription is unchanged.

Runtime environment: `APP_URL`, `SESSION_SECRET` (unique random 32+ bytes), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `IP_HASH_SECRET`, `AWS_REGION`, `AWS_ROLE_ARN`, `DATA_TABLE`. Use the ToolWorksLab Supabase project `nkifgvjtfwsojchttdvk`, and AWS role `arn:aws:iam::444115534902:role/ModolougeVercelManager`.

AWS access uses Vercel OIDC for this exact company/project/production subject. Enable the team issuer in Vercel and configure the exact production URL in Supabase. Preview deployments have no production role. Never commit secret values or expose server credentials through NEXT_PUBLIC variables.

## Development and verification

Node 24: `npm ci`, `npm run build`, `npm test`. There is no development authentication bypass.

Production builds and authentication tests pass. AWS IAM simulations verified manager access to the Linux instance and denial for the preserved Windows instance. The earlier deployment verified Vercel OIDC and rejected ordinary users from manager access. The Supabase upgrade still needs custom SMTP verification, production deployment, and an owner sign-in to inspect the authenticated dashboard. No live shutdown/restart cycle has been performed. See the companion application's `SUPABASE-VERIFICATION.md` for upgrade status.

## Cost interpretation

Estimates are USD, allocated using measured job time and configured EC2, public IPv4 and Rhino core-hour assumptions. Shared runtime is uptime minus job time; retained Linux storage is separate. Verify Rhino's billable core count against the actual invoice. Requests, transfer, Supabase, Vercel, taxes and other resources are excluded. Metering begins with this deployment.

Rhino.Compute Linux is McNeel WIP software with plugin and production-readiness limitations: https://developer.rhino3d.com/guides/compute/compute-linux-getting-started/

## Shared source

The companion repo is `ToolWorksLAB/modolouge`. Keep shared visual/auth/data files synchronized; this repository sets `manager` to true in `lib/config.js`. The worker and reviewed component policy live in the companion repository.

## Visitor monitoring

Supabase provides verified accounts, guest-session records, onboarding profiles, a visitor timeline with IP addresses, and job duration/cost data. The public trial is 5 geometry runs per guest/browser/network over 30 days. The manager shows current guests, linked accounts, uploads, queued and completed jobs, and verification/onboarding events. IPs expire after 30 days and activity after 90 days through a database cron job. Counts and exports cover the latest 1,000 people; event tables show the latest 100 records. Guest identities represent sessions, not identified people.

Raw IPs and all account data are server-only; anonymous/public Supabase roles cannot query these tables or quota functions. Administrator authorization is checked against the current verified Supabase Auth email, not profile metadata. The companion app repository contains the authoritative SQL migrations and worker telemetry implementation.
