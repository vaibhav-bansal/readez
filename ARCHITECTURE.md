# ReadEz Architecture

This document describes how ReadEz is put together: the pieces, how they talk to each other, and why certain decisions were made. It is aimed at contributors and future-me trying to remember why something is the way it is.

For setup instructions, see [CONTRIBUTING.md](CONTRIBUTING.md). For the API surface, see the routes section below and the Postman collection at [docs/ReadEz.postman_collection.json](docs/ReadEz.postman_collection.json).

## High-level picture

```
┌──────────────────────────────────────────────────────────────┐
│                         Browser                              │
│                                                              │
│  React SPA (Vite build)                                      │
│    • Landing, Library, Reader, Legal, Feedback, Sub*         │
│    • react-pdf / pdfjs-dist for rendering                    │
│    • Zustand for ephemeral state, TanStack Query for server  │
│    • PostHog for analytics (optional)                        │
└───────────────────────────────┬──────────────────────────────┘
                                │ fetch(credentials: 'include')
                                │ cookies: SESSION_COOKIE_NAME
                                ▼
┌──────────────────────────────────────────────────────────────┐
│                 FastAPI backend (uvicorn)                    │
│                                                              │
│  Routers:  /auth  /books  /progress  /subscription           │
│            /payments  /feedback  /webhooks  /health          │
│                                                              │
│  Middleware:                                                 │
│    • CORS (allows FRONTEND_URL with credentials)             │
│    • SPA middleware (serves index.html for non-API 404s      │
│      when STATIC_DIR exists — production only)               │
│                                                              │
│  Services:                                                   │
│    • StorageService (local disk, signed URLs)                │
└────────┬────────────────────────────────┬────────────────────┘
         │                                │
         ▼                                ▼
 ┌───────────────┐              ┌──────────────────┐
 │  PostgreSQL   │              │   Local disk     │
 │  (asyncpg)    │              │   storage/books/ │
 │               │              │   storage/thumb… │
 │   users       │              │                  │
 │   sessions    │              │   Signed URLs    │
 │   books       │              │   for access     │
 │   reading_…   │              └──────────────────┘
 │   subscripts  │
 │   payments    │                       ▲
 │   feedback    │                       │
 └───────┬───────┘              ┌────────┴────────┐
         │                      │  Dodo Payments  │
         │                      │   (webhooks)    │
         │                      └─────────────────┘
         ▼
   Google OAuth
   (token exchange)
```

Two deploy shapes exist today:

- **Single-container** (Railway, via `Dockerfile`) — the Vite build is copied into the FastAPI image and served as static files. One process, one URL.
- **Split** (Vercel frontend + separate backend) — the `vercel.json` file configures the frontend-only path. The backend runs elsewhere and the frontend calls it with absolute URLs.

The code is written so both shapes work without a rebuild.

## Frontend

### Stack

- **React 19** with function components and hooks
- **Vite 7** for dev server and build
- **React Router 7** for routing (`BrowserRouter`)
- **Tailwind CSS 4** for styling
- **Zustand 5** for client state that should survive route changes (see `src/store/progressStore.js`)
- **TanStack Query 5** for server data (books, reading progress, subscription status)
- **react-pdf 10** (`pdfjs-dist`) for PDF rendering
- **react-dropzone** for upload UX
- **react-hot-toast** for notifications
- **react-infinite-scroll-component** for the reader's page-by-page loading
- **PostHog JS** for product analytics (optional)

### Routes

Defined in [src/App.jsx](src/App.jsx):

| Path | Component | Auth | Notes |
|---|---|---|---|
| `/` | `Landing` | Public | Marketing page |
| `/legal` | `Legal` | Public | Terms + Privacy |
| `/feedback` | `Feedback` | Public | Anyone can submit feedback |
| `/library` | `Library` | Required | List of user's books |
| `/library/:bookId` | `Reader` | Required | The reading experience — **lazy-loaded** to keep the initial bundle small |
| `/subscription/success` | `SubscriptionSuccess` | Required | Post-checkout return |
| `/subscription/cancel` | `SubscriptionCancel` | Required | Post-checkout return |
| `/reader/:bookId` | redirect → `/library/:bookId` | — | Backward-compat for old URLs |
| `*` | redirect → `/` | — | 404 fallback |

The `Auth` component in `src/components/Auth.jsx` is the gate: it hits `GET /auth/status`, and either renders children or redirects to the landing page with a prompt to sign in.

### State management

We split state into three layers:

1. **Ephemeral UI state** — `useState` and `useReducer` inside components.
2. **Client state that crosses routes** — Zustand. Currently just `src/store/progressStore.js` for the reader's in-memory progress buffer (debounced before it hits the server).
3. **Server state** — TanStack Query. Every call to the ReadEz API goes through `src/lib/api.js`, which TanStack wraps for caching, revalidation, and mutation hooks.

The rule of thumb: if the data lives on the server, use TanStack Query and do not mirror it in Zustand. If you need to pass state between components that are not siblings, use Zustand.

### The reader

`src/pages/Reader.jsx` is the most complex component in the app. It does several things:

- **Signed URL fetch.** On load, it calls `GET /books/{id}/signed-url` to get a short-lived URL for the PDF.
- **Base64 data fetch.** It then calls `GET /books/{id}/data`, which returns a base64-encoded JSON payload instead of a raw PDF file. This bypasses download managers (IDM, etc.) that would otherwise intercept a `.pdf` response and try to save it to disk.
- **Blob URL.** The base64 is decoded to a `Blob` and handed to react-pdf as an object URL.
- **Infinite scroll.** Pages render on demand as the user scrolls. `react-infinite-scroll-component` drives the loading.
- **Navigation.** Keyboard (`←` / `→` / `Space` / `Home` / `End` / `g`), touch/swipe on mobile, and a page jump modal.
- **Zoom.** Dynamic fit-to-height calculation based on viewport, with manual zoom controls on top.
- **Progress tracking.** `currentPage`, scroll position within the current page, and zoom level are captured on every interaction and written to the backend via a 500 ms debounce. This prevents a hundred requests per minute during fast scrolling.
- **Progress restore.** On first mount, progress is fetched from the server and the reader jumps to the saved position exactly once — guarded by `hasRestoredRef` so a re-render does not re-restore and fight the user.

### PDF.js worker

`pdfjs-dist` needs its worker script in the served assets. The `scripts/copy-worker.js` file runs as a `postinstall` hook and copies the worker into `public/` so Vite can serve it. If the worker is missing, react-pdf throws a "Setting up fake worker" error and pages never render.

### Analytics

`src/lib/posthog.js` initializes PostHog if `VITE_POSTHOG_KEY` is set, and no-ops otherwise. Event names are centralized; add new ones in that file rather than calling `posthog.capture()` inline. The full event catalog lives in [docs/POSTHOG_EVENTS.md](docs/POSTHOG_EVENTS.md).

## Backend

### Stack

- **FastAPI** with async endpoints
- **SQLAlchemy 2.x** async ORM with **asyncpg** driver
- **Pydantic v2** for request/response schemas, via `pydantic-settings` for env configuration
- **httpx** for outbound HTTP (Google OAuth token exchange, Dodo API calls)
- **pypdf** for extracting page counts from uploaded PDFs
- **aiofiles** for async disk I/O in the storage service
- **python-jose** for JWT decoding (Google `id_token`)

### Entry point

`backend/app/main.py` wires everything up:

1. Configures logging.
2. Builds the FastAPI instance with a `lifespan` context manager that runs `init_db()` on startup.
3. Adds CORS middleware, allowing credentials from `FRONTEND_URL`.
4. Registers routers under their prefixes: `/auth`, `/books`, `/progress`, `/subscription`, `/payments`, `/feedback`, `/webhooks`. Plus a top-level `/health` for Railway's healthcheck.
5. If `/app/static` exists (production container build), mounts `/assets` as static files and installs SPA fallback middleware that serves `index.html` on any non-API 404.

The SPA fallback is middleware rather than a catch-all route because a route would shadow the `/health` check and cause Railway to fail startup.

### Routers

| Prefix | File | Purpose |
|---|---|---|
| `/auth` | `backend/app/routes/auth.py` | Google OAuth login, callback, logout, current user, status |
| `/books` | `backend/app/routes/books.py` | Upload, list, get, delete, thumbnail, signed URLs, data delivery, page count backfill |
| `/progress` | `backend/app/routes/progress.py` | Get / update reading progress per book |
| `/subscription` | `backend/app/routes/subscription.py` | Get active subscription + usage, create checkout |
| `/payments` | `backend/app/routes/payments.py` | Payment history |
| `/webhooks` | `backend/app/routes/webhooks.py` | Dodo subscription, payment, refund events |
| `/feedback` | `backend/app/routes/feedback.py` | User feedback submissions |
| `/health` | `main.py` | Unauthenticated healthcheck |

### Key API endpoints

A subset; see the Postman collection for the complete list.

**Auth:**

- `GET /auth/google/login` — returns `{ authorization_url }`, sets an `oauth_state` cookie (10 min, HttpOnly, Secure, SameSite=Lax) containing the PKCE state and verifier.
- `GET /auth/google/callback` — validates state, exchanges the code using PKCE S256, decodes the `id_token` JWT (trusted from Google HTTPS), upserts the user, creates a session, sets the session cookie, and returns an HTML page that posts a message to the parent window.
- `GET /auth/me` — current user.
- `GET /auth/status` — `{ authenticated: bool, user?: {...} }`, used by the frontend to gate routes.
- `POST /auth/logout` — deletes the session row and clears the cookie.

**Books:**

- `GET /books` — list current user's books, newest first.
- `POST /books` — multipart upload of a `.pdf` (max 100 MB). Extracts `total_pages` via `pypdf`, writes to `storage/books/{user_id}/{timestamp}.pdf`, creates a `Book` row and a matching `ReadingProgress` row.
- `GET /books/{id}/signed-url` — returns `{ url, expires_at }` where the URL is HMAC-signed against `SESSION_SECRET_KEY`.
- `GET /books/{id}/data?signature=…&expires=…` — returns `{ data: "base64…" }` to bypass download managers.
- `GET /books/{id}/file?signature=…&expires=…` — raw PDF response with `Content-Disposition: inline`.
- `POST /books/{id}/thumbnail` — upload a custom thumbnail (used by the frontend-generated first-page preview).
- `GET /books/{id}/thumbnail` — public, 24-hour cache.
- `PATCH /books/{id}/page-count` — lazy backfill if an older upload is missing a page count.

**Webhooks:**

- `POST /webhooks/subscription` — subscription created, renewed, cancelled, expired.
- `POST /webhooks/payment` — payment succeeded or failed.
- `POST /webhooks/refund` — refund issued.

All three verify the HMAC-SHA256 signature per the [Standard Webhooks](https://www.standardwebhooks.com) spec: `HMAC_SHA256(base64_decode(secret), "{webhook_id}.{webhook_timestamp}.{body}")`. The `whsec_` prefix on the secret is stripped before decoding. If the secret is not configured, verification is skipped (development convenience — never do this in production).

### Data model

All models live under `backend/app/models/`.

**User** (`user.py`)
- `id` UUID (pk), `email` (unique, indexed), `google_id` (unique, indexed), `name`, `avatar_url`, `created_at`, `updated_at`
- Cascades to sessions, books, reading_progress, subscription, payments, subscription_usage, feedback

**Session** (`session.py`)
- `id` UUID (pk), `user_id` FK, `token`, `user_agent`, `ip_address`, `expires_at`, `created_at`

**Book** (`book.py`)
- `id`, `user_id` FK, `title`, `file_name`, `file_path`, `file_size`, `total_pages` (nullable), `thumbnail_path` (nullable), timestamps
- One-to-one with `ReadingProgress` (cascade delete)

**ReadingProgress** (`book.py`)
- `id`, `user_id` FK, `book_id` FK (unique together with `user_id`), `current_page`, `scroll_position`, `zoom_level`, `last_read_at`, `updated_at`
- The `(user_id, book_id)` uniqueness guarantees exactly one progress row per book per user.

**Subscription** (`subscription.py`)
- `id`, `user_id` FK (unique — one sub per user), `tier` (`free` / `pro` / `plus`), `status` (`active` / `cancelled` / `expired` / `trialing`), `dodo_subscription_id` (unique), `dodo_customer_id`, `current_period_start`, `current_period_end`, `cancel_at_period_end`, timestamps

**Payment** (`subscription.py`)
- `id`, `user_id` FK, `subscription_id` FK (SET NULL on delete), `dodo_payment_id` (unique), `dodo_invoice_id`, `dodo_refund_id`, `amount` (cents), `currency`, `status`, `refund_amount`, `refunded_at`, `paid_at`, `webhook_data` (full payload), `created_at`

**SubscriptionUsage** (`subscription.py`)
- `id`, `user_id` FK, `feature` (`ai_summaries`, `storage_bytes`, etc.), `usage_count`, `reset_at` (for monthly resets), `updated_at`

**Feedback** (`feedback.py`)
- `id`, `user_id` FK (nullable — anonymous feedback allowed), `message`, `metadata`, `created_at`

### Migrations

The project uses a **lightweight, hand-rolled migration system** under `backend/migrations/`, not Alembic. Initial schema creation happens in `init_db()` via `Base.metadata.create_all()`. Explicit migrations (like `add_payment_external_ids.py`) are one-off Python scripts you run manually.

This is a deliberate choice for a small project. When the schema starts changing frequently or contributors multiply, switching to Alembic will be straightforward.

### Storage service

`backend/app/services/storage.py` wraps local disk access:

- Files are stored under `STORAGE_PATH/books/{user_id}/{unix_ms}.pdf`. Using a timestamp instead of the original filename prevents collisions and avoids leaking the user's naming habits.
- Signed URLs are HMAC-SHA256 tokens over `{book_id}|{user_id}|{expires_at}` with `SESSION_SECRET_KEY` as the key. Default TTL is short (minutes) — long enough for a page load, short enough to prevent link-sharing.
- Thumbnails live under `STORAGE_PATH/thumbnails/` and are served from a public endpoint with 24-hour cache.

**Note:** local disk is fine for a single-instance Railway deploy. If you scale to multiple replicas, this needs to move to object storage (S3, R2, etc.) — the interface is already isolated in `StorageService` so the swap is contained.

## Request flows

### Sign-in

1. Frontend opens a popup to `GET /auth/google/login` in a new window.
2. Backend generates PKCE verifier + challenge, stores them in an `oauth_state` cookie, returns `{ authorization_url }`.
3. Popup redirects to Google, user approves, Google redirects to `GET /auth/google/callback?code=…&state=…`.
4. Backend validates state against the cookie, exchanges the code for tokens using the stored PKCE verifier, decodes the `id_token`, upserts the user, creates a `Session` row with `user_agent` and `ip_address`, sets the session cookie.
5. Callback returns an HTML page that calls `window.opener.postMessage(...)` and closes itself. The parent window sees the message and refreshes its auth state.

### PDF upload

1. User drops a file on the library page. `react-dropzone` validates `.pdf` and size locally.
2. Frontend `POST /books` with multipart form data. Session cookie travels with the request.
3. Backend validates again, reads the file, runs `pypdf.PdfReader` to count pages, writes to disk, creates the `Book` row, flushes it (so the FK is valid), then creates the `ReadingProgress` row.
4. Response: the new book record including `id`, `total_pages`, and a `thumbnail_url` if one already exists.
5. The frontend optionally generates a first-page thumbnail client-side and uploads it via `POST /books/{id}/thumbnail`.

### Reading

1. User navigates to `/library/:bookId`. React Router lazy-loads the Reader bundle.
2. Reader calls `GET /books/{id}` (metadata + saved progress) and `GET /books/{id}/signed-url`.
3. Reader calls `GET /books/{id}/data?signature=…` with the signed URL; backend verifies the HMAC and expiry, returns `{ data: base64 }`.
4. Frontend decodes to `Blob`, creates an object URL, passes to react-pdf.
5. As the user scrolls, zooms, or jumps pages, a debounced `PATCH /progress/{book_id}` fires every 500 ms.

### Subscription upgrade

1. User clicks "Upgrade" in the subscription modal.
2. Frontend calls `POST /subscription/checkout` (or uses Dodo's client SDK directly with the configured product ID).
3. User is redirected to Dodo checkout.
4. On completion, Dodo posts to `/webhooks/subscription` with the new subscription details. Backend verifies the HMAC, upserts the `Subscription` row, updates the user's tier.
5. Dodo redirects the user to `/subscription/success`.
6. Frontend refetches subscription state via TanStack Query and renders the new badge.

## Deployment

### Railway (single container)

`railway.toml` points at the `Dockerfile`. The Dockerfile is a two-stage build:

1. **Stage 1: frontend-builder.** `node:20-alpine`, installs Python 3 (needed for `pdfjs-dist` native compilation), runs `npm ci` and `npm run build`. Outputs `dist/`.
2. **Stage 2: runtime.** `python:3.11-slim`, installs `libpq-dev` + `gcc`, `pip install -r backend/requirements.txt`, copies `backend/` and the `dist/` output into `/app/static/`, creates `/app/storage/{books,thumbnails}`, starts `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.

Railway's `PORT` env variable is respected. The healthcheck path is `/health` with a 300-second timeout and up to 3 restart retries.

Postgres URLs from Railway come as `postgresql://…`; the backend rewrites that to `postgresql+asyncpg://…` at startup so SQLAlchemy picks the right driver.

### Vercel (frontend only)

`vercel.json` configures a frontend-only deploy: `vite` framework, `dist` output, and rewrites for the SEO files (`robots.txt`, `sitemap.xml`, `llms.txt`, `humans.txt`, `ai.txt`, `.well-known/security.txt`) plus a catch-all rewrite to `index.html` for SPA routing. The backend needs to run separately and be reachable via CORS when using this deploy shape.

## Things worth knowing

- **Base64 data delivery is intentional.** Returning the PDF as JSON-encoded base64 looks inefficient, but it bypasses download managers like IDM that intercept `Content-Type: application/pdf` responses. If you "optimize" this back to a raw file response, users on Windows with IDM installed will lose the reading experience.
- **`init_db` creates tables but does not alter them.** Schema changes require a migration script. Do not rely on model edits propagating automatically on restart.
- **The session cookie is HttpOnly.** JavaScript cannot read it. All requests from the frontend use `credentials: 'include'` via the API client in `src/lib/api.js`.
- **Dodo webhook secrets come in three flavors** (subscription, payment, refund) for each environment (test, live). Six secrets total. See [backend/.env.example](backend/.env.example).
- **The reader is lazy-loaded.** Importing `pdfjs-dist` at the top level would blow up the landing page bundle. Keep the lazy boundary.
- **The `scripts/copy-worker.js` postinstall hook is load-bearing.** If it fails, the reader breaks with a confusing "fake worker" error.
