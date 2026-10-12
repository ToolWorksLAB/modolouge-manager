# Demo visitor analytics

The production demo at https://demo.toolworkslab.com reports optional visit analytics to this manager. The dashboard is at https://admin.toolworkslab.com/#demo-visitors. Existing verified-administrator authorization protects the report; service credentials never reach the browser.

## Collection and meaning

- The demo asks for opt-in before sending anything. Declining leaves every demo feature available. Browser Do Not Track and Global Privacy Control disable tracking. The footer lets visitors change their preference.
- Only the consent preference is stored locally (90 days). A page visit receives a random server-generated ID and a signed, six-hour token held in memory. Reloads count as separate visits. There is no cross-site identity, persistent visitor ID, name, email, screen recording, form-content capture or fingerprint.
- Every 20 seconds, while visible, a pulse reports cumulative active seconds and allowlisted tool/export counters. Hidden tabs and idle periods longer than 60 seconds stop accruing time. Page hide sends a final best-effort update. Closing a browser, network loss or blockers may prevent delivery, so durations are estimates.
- Vercel supplies approximate city/region/country and the connection IP. The IP is masked to /24 (IPv4) or /48 (IPv6) before storage; raw user agents are reduced to device, browser and OS categories. VPNs and browser privacy settings affect accuracy. Referrers are reduced to the hostname, with no paths or query strings.
- Local demo previews do not send production analytics. Standard bot user-agent patterns are ignored. The report covers consenting page visits, not unique people or complete traffic.

## Backend and data

- POST/OPTIONS /api/demo/visit: exact demo origin, 4 KiB streaming body limit, explicit consent, bounded values, server-created IDs and signed tokens. Cookies are omitted. CORS grants no read access to reporting routes.
- GET /api/admin/demo-visitors?days=7&offset=0: requireUser(true), no-store responses, 1/7/30/90-day periods and 50-row pagination. SQL aggregates all matching visits before applying the row-page limit.
- Supabase project nkifgvjtfwsojchttdvk (ToolWorksLab); table modolouge_demo_visits and functions modolouge_demo_pulse / modolouge_demo_report.
- Supabase RLS is enabled, with no anon/authenticated table or RPC permissions. The service role is the sole application database accessor. The no-policy advisor note is intentional server-only access; see https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.
- Atomic pulses ignore duplicate or older sequence numbers and clamp active time to elapsed server time. Counters use cumulative maxima. No geometry runs or AI calls are triggered.
- The existing IP_HASH_SECRET signs visit tokens and creates domain-separated daily connection hashes for rate limits. Limits: 240 pulses/minute/network, 60 visit starts/hour/network and 5,000 starts/day globally. Entries use the existing expiry/cleanup of modolouge_limits.
- Cron modolouge-demo-retention runs daily at 03:50 UTC and removes visits older than 90 days. Infrastructure request logs remain governed by provider settings.

## Maintenance

This repo owns supabase/migrations/20261012205320_demo_visitor_analytics.sql. It is additive to the shared Modolouge database. Apply only to the ToolWorksLab project. No new secrets or paid add-ons are required; requests use the existing Vercel/Supabase allowance.

The Vite demo sources currently live in the independent src/demo entry in the Plantar3d_WebApp local checkout and deploy through scripts/package-service-demo.mjs to toolworkslab-demo. Publishing the manager uses this repo's existing main → production integration. Deploy the backend before enabling the demo collector.

## Verification

npm test covers exact origin, consent, request size, token tampering/expiry, masked metadata, device parsing, rate limits and admin authorization. Existing auth tests also reject non-admin verified accounts. Production builds validate the routes and components.

The demo's scripts/verify-demo-analytics.ts checks idle/hidden-time boundaries and resumed engagement. SQL was exercised in isolated PGlite for duplicate/out-of-order updates, elapsed-time caps, report aggregation, role privileges and 90-day retention. After release, allow analytics in a real demo tab, interact, wait for a pulse, and verify the corresponding session in the signed-in admin panel. Check decline and withdrawal send no further heartbeats.

Security advisors retain an unrelated existing Auth warning about leaked-password protection (https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); this change does not alter account authentication settings.
