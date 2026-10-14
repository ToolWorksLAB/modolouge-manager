# Admin password login

Updated 2026-10-15. Applies to the manager at https://admin.toolworkslab.com only.

Sign in at `/signin` with `info@toolworkslab.com` and the existing account password. Normal sign-in does not send an email. The encrypted, HttpOnly, Secure host cookie lasts up to 30 days and Supabase refreshes its tokens while the session remains valid.

To set or recover the password, choose **Set or recover password**. Request an email verification code, enter the newest code in the same browser, and choose and confirm a password of 12–128 characters. After saving, sign in with the new password. Passwords are submitted directly to Supabase Auth through the server; they are never stored in the repository or activity logs.

Recovery uses the existing Supabase email OTP delivery, with account creation disabled. The verified result is stored in a separate encrypted recovery cookie valid for 10 minutes. It cannot authorize dashboard requests. A password update checks the current verified admin identity and blocked status, rotates a server-controlled `app_metadata.admin_session_version`, and revokes all Supabase refresh sessions. The manager compares the version against the current Auth user on protected requests, rejecting old manager cookies without waiting for their JWT expiration. Failed session cleanup is reported explicitly.

Email OTP sign-in is no longer accepted by the manager. Its `send-code` action requires `purpose: "password-recovery"`; `verify-code` produces a recovery cookie. Public Modolouge authentication is unchanged.

Endpoints: POST `/api/auth/password-login`, `/api/auth/send-code`, `/api/auth/verify-code`, and `/api/auth/reset-password`. Same-origin checks and server-side network rate limits apply. Recovery does not change the account email, grant admin roles, create accounts, or unblock accounts.

Validation: 19 tests covering password login, recovery scope, verified admin restriction, blocked users, throttling, cross-origin requests, old-session rejection, existing auth protections and demo analytics.
