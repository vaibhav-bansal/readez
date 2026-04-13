# ReadEz Backend

FastAPI service that powers the ReadEz reader. Handles authentication, PDF storage, reading progress sync, subscriptions, and webhooks from Dodo Payments.

For the full project overview, see [../README.md](../README.md). For the architecture, see [../ARCHITECTURE.md](../ARCHITECTURE.md).

## Stack

- **Python 3.11+**
- **FastAPI** (async)
- **SQLAlchemy 2.x** with the `asyncpg` driver for PostgreSQL
- **Pydantic v2** for request/response schemas and settings
- **httpx** for outbound HTTP (Google OAuth, Dodo API)
- **pypdf** for PDF page count extraction
- **aiofiles** for async file I/O

Full dependency list in [requirements.txt](requirements.txt).

## Directory layout

```
backend/
  app/
    main.py              FastAPI app, router registration, SPA middleware, /health
    config.py            Pydantic settings loaded from environment
    database.py          Async engine, session factory, init_db()
    models/
      __init__.py        Re-exports all models and enums
      user.py            User
      session.py         Session (server-side login sessions)
      book.py            Book, ReadingProgress
      subscription.py    Subscription, Payment, SubscriptionUsage, SubscriptionTier, SubscriptionStatus
      feedback.py        Feedback
    routes/
      __init__.py        Router aggregation
      auth.py            /auth/* — Google OAuth, sessions, /me, /status, /logout
      books.py           /books/* — upload, list, get, delete, signed URLs, data delivery, thumbnails, page count backfill
      progress.py        /progress/* — reading progress read/write
      subscription.py    /subscription/* — active subscription, usage, checkout
      payments.py        /payments/* — payment history
      webhooks.py        /webhooks/* — Dodo subscription, payment, refund event handlers
      feedback.py        /feedback/* — user feedback submissions
    services/
      storage.py         StorageService — disk I/O, signed URLs, thumbnails
    middleware/
      auth.py            get_current_user dependency, session cookie handling
  migrations/            Lightweight Python migration scripts (not Alembic)
  storage/               Runtime storage for books and thumbnails (gitignored)
  requirements.txt
  .env.example
```

## Setup

### 1. Create a virtual environment

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # macOS / Linux
.venv\Scripts\activate              # Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Must use the `postgresql+asyncpg://` scheme |
| `GOOGLE_CLIENT_ID` | Yes | From Google Cloud Console OAuth credentials |
| `GOOGLE_CLIENT_SECRET` | Yes | From Google Cloud Console OAuth credentials |
| `SESSION_SECRET_KEY` | Yes | Random string, minimum 32 characters. Used for session signing and signed URLs. |
| `SESSION_EXPIRE_DAYS` | No | Default `30` |
| `FRONTEND_URL` | Yes | Used for CORS and OAuth redirect building. `http://localhost:5173` for local dev. |
| `BACKEND_URL` | Yes | Used to build OAuth callback URLs. `http://localhost:8000` for local dev. |
| `STORAGE_PATH` | No | Default `./storage`. Where uploaded PDFs and thumbnails live. |
| `ENVIRONMENT` | No | `development` (default) or `production`. Controls which Dodo credentials are active. |
| `DEBUG` | No | Default `false` |

**Dodo Payments** variables are optional and only required if you are testing subscriptions. Six secrets per environment (test / live) — see [.env.example](.env.example).

**A note on `DATABASE_URL`:** Railway and some other hosts provide `postgresql://…`. The app rewrites that to `postgresql+asyncpg://…` at startup, so either form works at deploy time. For local dev, write it with the `+asyncpg` scheme explicitly.

### 4. Set up PostgreSQL

```bash
createdb readez
```

Tables are created automatically by `init_db()` on first startup via `Base.metadata.create_all()`. There is no separate "run migrations" step for the initial schema — migrations live in `migrations/` as standalone Python scripts for schema changes after the initial deploy.

### 5. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000`. Open `http://localhost:8000/docs` for FastAPI's auto-generated OpenAPI UI.

## Key endpoints

A quick reference. For the full surface, run the server and visit `/docs`, or import [../docs/ReadEz.postman_collection.json](../docs/ReadEz.postman_collection.json) into Postman.

### Health

- `GET /health` — returns `{ status: "healthy", environment }`. Used by Railway.

### Auth

- `GET /auth/google/login` — returns `{ authorization_url }`, sets `oauth_state` cookie (10 min).
- `GET /auth/google/callback?code=…&state=…` — OAuth callback. Validates state, exchanges code with PKCE, upserts the user, sets the session cookie, returns an HTML page that posts a message to the opener window.
- `GET /auth/me` — current authenticated user.
- `GET /auth/status` — `{ authenticated: bool, user?: {...} }`.
- `POST /auth/logout` — deletes the session row and clears the cookie.

### Books

- `GET /books` — list current user's books.
- `POST /books` — multipart upload. Extracts `total_pages`, writes to disk, creates `Book` + `ReadingProgress`.
- `GET /books/{id}` — book metadata.
- `DELETE /books/{id}` — deletes row and cascades to file and thumbnail.
- `GET /books/{id}/signed-url` — returns `{ url, expires_at }` for secure file access.
- `GET /books/{id}/data?signature=…&expires=…` — base64-encoded JSON payload (bypasses download managers).
- `GET /books/{id}/file?signature=…&expires=…` — raw PDF response with `inline` disposition.
- `POST /books/{id}/thumbnail` — upload a custom thumbnail.
- `GET /books/{id}/thumbnail` — public thumbnail endpoint, 24-hour cache.
- `PATCH /books/{id}/page-count` — lazy backfill of `total_pages` from the frontend.
- `POST /books/backfill/page-counts` — bulk backfill for the user's books.

### Progress

- `GET /progress/{book_id}` — current reading progress.
- `PATCH /progress/{book_id}` — update `current_page`, `scroll_position`, `zoom_level`. Frontend calls this with a 500 ms debounce.

### Subscription / Payments

- `GET /subscription` — active subscription, usage, recent payments.
- `POST /subscription/checkout` — create a Dodo checkout session (details depend on tier).
- `GET /payments` — payment history.

### Webhooks (Dodo Payments)

- `POST /webhooks/subscription` — subscription lifecycle events.
- `POST /webhooks/payment` — payment succeeded / failed.
- `POST /webhooks/refund` — refunds.

All three verify the signature using HMAC-SHA256 over `{webhook_id}.{webhook_timestamp}.{body}` with a base64-decoded secret, per the [Standard Webhooks](https://www.standardwebhooks.com) spec.

### Feedback

- `POST /feedback` — submit feedback. Works anonymously or authenticated.

## Data model

The full model is in [../ARCHITECTURE.md](../ARCHITECTURE.md#data-model). Quick summary:

- **User** — Google identity, profile, timestamps.
- **Session** — server-side login sessions with user agent and IP.
- **Book** — uploaded PDF metadata (file path, size, page count, thumbnail).
- **ReadingProgress** — one per (user, book) with current page, scroll, zoom.
- **Subscription** — one per user, linked to Dodo.
- **Payment** — payment and refund history keyed by Dodo IDs.
- **SubscriptionUsage** — per-feature usage counters with monthly resets.
- **Feedback** — user feedback, optionally anonymous.

## Migrations

Migrations are lightweight Python scripts under `migrations/`. Example: [`add_payment_external_ids.py`](migrations/add_payment_external_ids.py).

To run a migration:

```bash
cd backend
source .venv/bin/activate
python -m migrations.add_payment_external_ids
```

Write new migration scripts following the same pattern: import the async engine, execute the DDL, commit, print a confirmation. If the schema starts changing frequently, we will migrate to Alembic.

**Do not rely on `init_db()` for anything beyond initial table creation.** It calls `Base.metadata.create_all()`, which does not alter existing tables.

## Storage

`StorageService` in [app/services/storage.py](app/services/storage.py) wraps all file I/O. Files are stored under:

```
{STORAGE_PATH}/books/{user_id}/{unix_ms}.pdf
{STORAGE_PATH}/thumbnails/{user_id}/{unix_ms}.jpg
```

Using a Unix-millisecond timestamp as the filename prevents collisions and does not leak original filenames.

**Signed URLs** are HMAC-SHA256 tokens over `{book_id}|{user_id}|{expires_at}` with `SESSION_SECRET_KEY` as the key. Short-lived by design — long enough for a page load, short enough to prevent link-sharing.

**Scaling note:** local disk works fine for a single-instance deploy. Multi-replica setups need to move to object storage (S3, R2, etc.). The interface is already isolated in `StorageService`, so the swap is contained.

## Testing

There is no backend test suite yet. If you are adding one:

- Put tests under `backend/tests/`
- Use `pytest` + `pytest-asyncio`
- Use a separate test database (respect `DATABASE_URL` via pytest fixtures)
- Start with the high-value paths: auth callback, book upload, progress updates, webhook verification

Frontend tests live in the root (`src/**/*.test.{js,jsx}`) and run with `npm test` from the repo root.

## Common issues

**`sqlalchemy.exc.InvalidRequestError: Mapper … already has a property …`** — happens when a model file is imported twice with different paths. Fix: use absolute imports (`from app.models import User`), not relative.

**`asyncpg.exceptions.InvalidPasswordError`** — your `DATABASE_URL` password is wrong or URL-escaped incorrectly. Special characters must be percent-encoded.

**`Setting up fake worker` in the frontend reader** — not a backend issue. Run `npm run postinstall` from the repo root to copy the PDF.js worker.

**Railway healthcheck failing** — confirm `uvicorn` is binding to `$PORT`, not a hardcoded port. The Dockerfile handles this; if you change the `CMD`, keep the `$PORT` variable.

**Google OAuth redirect mismatch** — the callback URL registered in Google Cloud Console must exactly match `{BACKEND_URL}/auth/google/callback`. Trailing slashes matter.

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — full system architecture
- [../CONTRIBUTING.md](../CONTRIBUTING.md) — contributor guide
- [../SECURITY.md](../SECURITY.md) — security policy
- [../CLAUDE.md](../CLAUDE.md) — AI assistant conventions
