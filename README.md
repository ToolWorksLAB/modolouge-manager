# Modolouge Manager

ToolWorksLab's independent administration panel for Modolouge, using the company's graphite, cream and magenta design system.

Only a Cognito-verified `info@toolworkslab.com` account can use this panel. Every admin API request checks the encrypted session, current account state and administrator email. Mutations require a matching Origin. Ordinary verified accounts cannot read this dashboard or control EC2.

The dashboard shows accounts, approximate country/city, last activity, job counts, durations, failures, cost estimates, shared runtime and administrative history. Usage exports to CSV. Blocking takes effect for existing sessions and queued jobs.

Start/stop targets only Linux EC2 `i-0c6e3386ff6d66b5b` in `eu-north-1`. The public-app role cannot stop it; the manager cannot control preserved Windows instances. The manager remains online when compute stops. Stopping disables submissions and stops EC2; retained storage and other services can still cost money.

## Deployment

GitHub: `ToolWorksLAB/modolouge-manager`, production branch `main`. Intended company Vercel team: `team_D2suiiZSHHspd8E4WqQuvMeY` / `info-85726815s-projects`. Never use the Plantar3D client workspace.

The owner authorized making this repository public. It is connected to the company Vercel Hobby workspace; pushes to `main` deploy production at [modolouge-manager.vercel.app](https://modolouge-manager.vercel.app). The public workspace is [modolouge.vercel.app](https://modolouge.vercel.app). The Vercel subscription is unchanged.

Runtime environment: `APP_URL`, `SESSION_SECRET` (unique random 32+ bytes), `COGNITO_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`, `AWS_REGION`, `AWS_ROLE_ARN`, `DATA_TABLE`. Use Cognito client `4kil76ajv9o6gjcrkcg9807kli` in pool `eu-north-1_c2tNv7bsF`, and AWS role `arn:aws:iam::444115534902:role/ModolougeVercelManager`.

AWS access uses Vercel OIDC for this exact company/project/production subject. Enable the team issuer in Vercel and register the exact production URL with Cognito. Preview deployments have no production role. Never commit secret values or expose server credentials through NEXT_PUBLIC variables.

## Development and verification

Node 24: `npm ci`, `npm run build`, `npm test`. There is no development authentication bypass.

Production build and six authentication tests pass. AWS IAM simulations verified manager access to the Linux instance and denial for the preserved Windows instance. Signed-out desktop/mobile pages were browser checked. Live Cognito callback, Vercel OIDC, authenticated dashboard and actual shutdown UI await hosting linkage and production verification.

## Cost interpretation

Estimates are USD, allocated using measured job time and configured EC2, public IPv4 and Rhino core-hour assumptions. Shared runtime is uptime minus job time; retained Linux storage is separate. Verify Rhino's billable core count against the actual invoice. Requests, transfer, Cognito, Vercel, taxes and other resources are excluded. Metering begins with this deployment.

Rhino.Compute Linux is McNeel WIP software with plugin and production-readiness limitations: https://developer.rhino3d.com/guides/compute/compute-linux-getting-started/

## Shared source

The companion repo is `ToolWorksLAB/modolouge`. Keep shared visual/auth/data files synchronized; this repository sets `manager` to true in `lib/config.js`. The worker and reviewed component policy live in the companion repository.
