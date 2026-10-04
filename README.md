# Modolouge

ToolWorksLab's public Grasshopper workspace. A Next.js frontend on Vercel submits asynchronous jobs to an Ubuntu EC2 Rhino.Compute 9 worker. Drag in a supported `.gh` or `.ghx`, adjust sliders, and update the Three.js viewport.

## Production

- GitHub: `ToolWorksLAB/modolouge`, production branch `main`.
- Vercel team: `info-85726815s-projects` / `team_D2suiiZSHHspd8E4WqQuvMeY` (company workspace).
- Administrator: `info@toolworkslab.com`; separate `ToolWorksLAB/modolouge-manager` repository.
- AWS region `eu-north-1`; Linux instance `i-0c6e3386ff6d66b5b` only. Existing Windows instances are outside these controls.

## Develop

Node 24: `npm ci`, `npm run dev`. Production build: `npm run build`. Authentication needs HTTPS and the exact registered Cognito callback. Do not add a production auth bypass for local development.

Required server environment: `APP_URL`, `SESSION_SECRET` (random 32+ bytes), `COGNITO_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_DOMAIN`, `AWS_ROLE_ARN`, `AWS_REGION`, `DATA_TABLE`, `FILE_BUCKET`, `JOB_QUEUE_URL`. Never expose these through `NEXT_PUBLIC_` or commit `.env` files.

Production AWS access uses Vercel OIDC, restricted to the company team, this project, and `production`. No static AWS access keys are used. Preview deployments have no production role. Cookies are encrypted, HTTP-only, Secure and SameSite=Lax; OAuth uses PKCE, state and nonce, and validates Cognito token issuer/audience/signature and verified email. Every mutation checks Origin and server-side account state.

## Worker

`worker/install.sh` installs the runtime and worker under `/opt/modolouge-worker`, publishes the source-only GH_IO archive bridge against the installed Rhino Linux DLL, and starts systemd services. Proprietary Rhino DLLs and the billing token are not included in this repository. The existing root-only Rhino environment remains on the EC2 host.

The browser uploads directly to private S3 with a short-lived signed POST. The API stores an owner-scoped definition, enforces quotas transactionally, and enqueues an SQS message. The worker validates an explicit component-ID allowlist before calling loopback Rhino.Compute, stores a preview result in S3, and atomically records job usage. Job/result authorization checks the current user, including blocked state.

Public compatibility is deliberately limited to `worker/component-policy.json`. Script, cluster, expression and unknown plugin components are rejected. This is not an arbitrary code sandbox. Expand the list only after reviewing component behavior, archive deserialization and resource limits. Current limits: 20 MB upload, 500 components, 60 jobs/account/day, 600 shared jobs/day, one outstanding job/account, three-minute processing limit, 40 MB result. Definition preparation counts as a job. Temporary source/prepared/result files expire after 24 hours with asynchronous S3 cleanup.

## Manager and costs

The manager uses a separate OIDC role with start/stop permissions restricted to the Linux instance. It remains online when compute stops. Stopping prevents new jobs and stops EC2; it does not delete storage or other AWS resources.

Cost attribution uses measured processing seconds at configured EC2 + IPv4 + Rhino rates. Shared runtime is metered uptime minus recorded job processing. The Rhino billable core count is an explicit assumption; verify it against billing. Estimates exclude taxes, data transfer, storage requests, Cognito, Vercel and other resources. This is not a billing invoice.

## Design

Derived from ToolWorksLab's own `TWLWeb` website: graphite `#0A0D0F`, cream `#FFFFF8`, magenta `#E91B8C`; Poppins body text, monospace headings, pill navigation, generous spacing and geometric line artwork. Shared files in the two repositories must remain in sync, except `lib/config.js`'s manager flag, metadata and deployment environment.

## Operations

Inspect `systemctl status modolouge-worker rhino-compute` and sanitized journald logs. Never print `/etc/rhino-compute/environment`. The worker uses the instance profile for S3/DynamoDB/SQS; Rhino's service is denied access to instance metadata. Start/stop and account blocking are audited in DynamoDB. Cloud provider billing remains the source of truth.
