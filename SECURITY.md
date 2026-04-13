# Security Policy

ReadEz handles user authentication, uploaded files, and payment processing. Security reports are taken seriously and prioritized above feature work.

## Reporting a vulnerability

**Do not open a public GitHub issue for security problems.** Please use one of these channels instead:

1. **GitHub Private Vulnerability Reporting** (preferred)
   Go to the [Security tab](https://github.com/vaibhav-bansal/readez/security) of the repository and click "Report a vulnerability". This creates a private advisory that only the maintainer can see.

2. **Email**
   If private reporting is not available, contact the maintainer directly through the email address on their [GitHub profile](https://github.com/vaibhav-bansal).

When reporting, please include:

- A description of the vulnerability and its impact
- Steps to reproduce (or a proof-of-concept if you have one)
- The affected version, commit, or deployment URL
- Any mitigating factors you are aware of
- Whether you want to be credited publicly once the fix lands

## What to expect

- **Acknowledgement:** within 72 hours of your report.
- **Triage:** within 7 days, with an initial assessment of severity and scope.
- **Fix and disclosure:** timeline depends on severity. Critical issues get patched as fast as possible; lower-severity issues get scheduled.
- **Credit:** if you want it, you will be credited in the release notes and the security advisory.

Please do not publicly disclose the issue until a fix has been released and you have given users a reasonable window to update.

## Scope

In scope:

- The ReadEz web application (`src/`) and backend API (`backend/app/`)
- Authentication and session handling
- File upload, storage, and signed-URL access control
- Dodo Payments webhook handling
- The official deployment at the URL listed in README.md
- The `Dockerfile` and deployment configurations (`railway.toml`, `vercel.json`)

Out of scope:

- Issues in third-party dependencies (report those to the upstream project; we will track and upgrade)
- Denial-of-service attacks that require unrealistic traffic volumes
- Social engineering against maintainers or users
- Physical attacks
- Missing security headers on pages that do not handle sensitive data, where no practical attack exists
- Self-hosted installations that have modified the default security configuration
- Attacks requiring compromised developer machines or malicious dependencies at install time

## Known security posture

This section is meant to help security researchers understand what is already in place, so you can focus on real gaps rather than re-reporting intentional choices.

### Authentication

- **Google OAuth 2.0 with PKCE (S256).** Authorization codes cannot be replayed without the verifier.
- **State parameter** is generated per request and stored in a short-lived (10 min) HttpOnly cookie, validated on callback to prevent CSRF on the OAuth flow.
- **`id_token` handling.** The token is decoded as a JWT without signature verification because it is received directly from Google over HTTPS in a backchannel (token endpoint) request. Signature verification is not required in this flow per RFC 8252. If we ever move to a flow where the `id_token` comes through an untrusted path, verification becomes mandatory.

### Sessions

- **Cookies:** `HttpOnly`, `Secure` (auto-detected via `X-Forwarded-Proto` for Railway), `SameSite=Lax`, default 30-day expiry.
- **Server-side session rows** in Postgres allow revocation. Logout deletes the row; compromised sessions can be forcibly ended.
- **Session metadata** (`user_agent`, `ip_address`) is stored for audit purposes.

### File access

- **Signed URLs.** Book file and data endpoints require a signed URL with an expiry timestamp. The signature is HMAC-SHA256 over `{book_id}|{user_id}|{expires_at}` using `SESSION_SECRET_KEY`. Links are short-lived.
- **Per-user directories.** Files are stored under `storage/books/{user_id}/`, and ownership is checked on every access regardless of the signed URL. Signed URLs alone are not sufficient.
- **File name sanitization.** Uploaded files are renamed to `{unix_ms}.pdf` on disk. The original filename never hits the filesystem.
- **Upload validation.** `.pdf` extension and max 100 MB size enforced on the backend (frontend validation is only a UX convenience).

### Payments and webhooks

- **Webhook signature verification** follows the [Standard Webhooks](https://www.standardwebhooks.com) spec: HMAC-SHA256 over `{webhook_id}.{webhook_timestamp}.{body}` with a base64-decoded secret, constant-time comparison.
- **Separate secrets** for subscription, payment, and refund event types, and separate sets for test vs live environments.
- **Webhook payloads** are stored in the `Payment.webhook_data` column for audit and dispute handling.
- **If the webhook secret is not configured, verification is skipped.** This is a deliberate development convenience. In production, **always** configure webhook secrets. Missing secrets in production is a configuration bug and should be treated as a security issue.

### Input validation

- **Pydantic v2 models** validate every request body. FastAPI rejects malformed payloads before they reach route handlers.
- **SQLAlchemy ORM** parameterizes all queries. There is no raw SQL in the codebase.
- **CORS** is scoped to `FRONTEND_URL` with credentials allowed. No wildcard origins.

### Secrets

- **No secrets in the repository.** `.env`, `.env.production`, and `backend/.env` are gitignored. Only `.env.example` files (with placeholder values) are tracked.
- **`SESSION_SECRET_KEY`** is required. A minimum of 32 characters is expected but not enforced — please use a cryptographically random value in production.
- **Google, Dodo, and PostHog credentials** are loaded from the environment at startup via `pydantic-settings`.

## Things we know are weaker than they should be

Transparent about current gaps, so researchers know where to look and users know what to expect:

- **No rate limiting.** Login, upload, and webhook endpoints are not rate-limited. A determined attacker can brute-force login flows or upload spam. On the roadmap.
- **No virus scanning on uploads.** Uploaded PDFs are trusted to be well-formed. Malicious PDFs with exploits targeting older PDF.js versions are possible. Keeping `pdfjs-dist` up to date is currently the only mitigation.
- **`init_db()` auto-creates tables** from models on startup. Schema drift between models and production is possible. Explicit migrations (see [backend/migrations/](backend/migrations/)) partially mitigate this.
- **`SESSION_SECRET_KEY` rotation requires re-login for all users.** There is no key rotation window.
- **Session cookies do not have a fingerprint.** A stolen cookie works until the session expires or is revoked. Binding sessions to user agent or IP is a tradeoff (usability vs security) we have not made yet.
- **Local disk storage** means a single-host deploy. Multi-region or multi-replica setups would need object storage. Not a vulnerability per se, but an operational constraint worth knowing.

If you find something not listed here, please report it.

## Hardening checklist for self-hosters

If you are running your own instance of ReadEz, please:

- Set `SESSION_SECRET_KEY` to a long random value (`python -c "import secrets; print(secrets.token_urlsafe(48))"`).
- Set `ENVIRONMENT=production`.
- Configure all six Dodo webhook secrets if you are using subscriptions.
- Terminate TLS at your load balancer and pass `X-Forwarded-Proto: https` to the container.
- Restrict database network access to the application host.
- Run database backups.
- Keep dependencies up to date — `npm audit` and `pip list --outdated` are your friends.
- Subscribe to this repository's releases so you get notified when security-relevant fixes land.

Thank you for helping keep ReadEz and its users safe.
