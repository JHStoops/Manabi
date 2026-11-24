# auth module

Accounts, sign-in, sessions and the guard every `/api/v1` route goes through (SDD section 11; FR-001, FR-003 to FR-006, IF-06, NFR-10 to NFR-12, NFR-14).

- `routes.ts`: `POST /auth/login`, `POST /auth/accept-invite`, `POST /auth/logout`, `POST /auth/change-password`, `GET /me`, `PATCH /me` (profile and settings, FR-007), `GET /me/sessions`, `DELETE /me/sessions/:id`. Zod schemas come from `@manabi/core` (`auth.ts`).
- `service.ts`: business rules and transactions. Also `createInvite` and `setTemporaryPassword`, which the admin console (#23) exposes.
- `queries.ts`: all SQL. Expiry comparisons use the database clock.
- `guard.ts`: the `onRequest` hook registered by `buildApp`, cookie helpers, `requireAuth` and `scopedUserId`.
- `passwords.ts`, `commonPasswords.ts`, `tokens.ts`: hashing, the password rules and token format.

## Rules

- **Routes are private by default.** A route opts out with `config: { public: true }`. Routes under `/api/v1/admin` and `/api/v1/authoring` need the admin role; `config: { role }` can ask for it elsewhere.
- **Temporary passwords (FR-005).** A session whose account has `must_change_password` may only use routes with `config: { allowPasswordChangeRequired: true }`: change-password, `GET /me` (so the web app knows to show that screen) and sign-out. Everything else answers 403 `password_change_required`. A temporary password stops working 7 days after it was set.
- **Scoping (NFR-14).** Services that act on one user's data take a `ScopedUserId`, which only the guard produces (`scopedUserId(request)`), never an id from the path, query or body.
- **Passwords (NFR-10).** Argon2id, 19 MiB, 2 iterations, 1 lane (OWASP). New passwords need 10 characters, must not be on the common-password list (SecLists, MIT) and must not equal the username. Sign-in against an unknown account checks a dummy hash, made when the routes are registered, so it takes as long as a wrong password from the first request on.
- **Tokens (NFR-10).** 256 random bits, sent as 43 base64url characters, stored as their SHA-256 hex digest. Not an HMAC: the token's entropy already defeats brute force on a leaked database, and rotating `SESSION_SECRET` then does not end every session.
- **Sessions (FR-003, IF-06).** 30 days from last use. The expiry slides at most once an hour (one write per hour of use, not per request), and the cookie is re-sent when it does. Web clients get an `HttpOnly`, `SameSite=Lax` cookie on path `/api/v1`, always `Secure` in production and elsewhere whenever the request arrived over HTTPS (`X-Forwarded-Proto` from Nginx Proxy Manager); the token never appears in a web response body. Other clients (`clientKind: "mobile"`) get the token in the body and send `Authorization: Bearer`. A bearer header wins over the cookie. Disabled accounts' sessions stop working at once. Changing the password ends every session and issues the caller a new one.
- **Origin check.** A state-changing request that uses the cookie must carry an `Origin` equal to `PUBLIC_URL`'s origin; any state-changing request that carries an `Origin` must match it. Outside production the request's own origin is accepted too, for the Vite dev proxy. Bearer requests without `Origin` pass.
- **Rate limits (NFR-12).** 10 attempts per 15 minutes (sliding window) per IP and per name on sign-in, accept-invite and change-password, kept in memory because the API is one process. IPv6 clients count by their /64 prefix, since one client usually holds a whole /64; IPv4 and IPv4-mapped addresses count as they are. Refused attempts are not counted. The 429 carries `Retry-After`. The limiter holds at most 100,000 keys and never drops a live one: when it is full, attempts on new keys are refused until the oldest key's window has passed. The password-reset routes (#23) should use the same `app.attemptLimiter`.
- **Sign-in counts by the name as typed, not by account.** The lower-cased identifier is the key, so a username and that account's email have separate counts. Keying by the resolved account would let anyone learn which email belongs to which username by watching one count move when the other is tried. The trade-off: an attacker gets 10 guesses per spelling, so up to 20 per 15 minutes against an account that has an email, instead of 10.
- **Signing in again** from a browser that still holds a session cookie deletes that older session.
