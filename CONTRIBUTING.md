# Contributing to ReadEz

Thanks for your interest in ReadEz. This document covers how to set up a development environment, the expected code style, and the pull request process.

If you just want to report a bug or request a feature, open an issue on [GitHub Issues](https://github.com/vaibhav-bansal/readez/issues). For security vulnerabilities, see [SECURITY.md](SECURITY.md) — do not file those as public issues.

## Prerequisites

You will need:

- **Node.js 20 or newer** (the Dockerfile uses `node:20-alpine`)
- **Python 3.11 or newer** (the Dockerfile uses `python:3.11-slim`)
- **PostgreSQL 14 or newer**, accessible locally or via a hosted provider
- **Google OAuth credentials** — a Cloud Console project with an OAuth 2.0 client ID and a redirect URI of `http://localhost:8000/auth/google/callback` for local dev
- **Git**

Optional:

- A [PostHog](https://posthog.com) project for analytics (development works fine without it)
- [Dodo Payments](https://dodopayments.com) test credentials if you plan to touch subscription code

## First-time setup

### 1. Clone and install frontend dependencies

```bash
git clone https://github.com/vaibhav-bansal/readez.git
cd readez
npm install
```

The `postinstall` script copies the PDF.js worker into `public/`. If you see missing-worker errors later, run `npm run postinstall` manually.

### 2. Install backend dependencies

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # macOS / Linux
.venv\Scripts\activate              # Windows (PowerShell or cmd)
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy both example env files and fill them in:

```bash
cp .env.example .env                # frontend
cp backend/.env.example backend/.env # backend
```

Minimum required values for local development:

| Variable | Where | Notes |
|---|---|---|
| `DATABASE_URL` | `backend/.env` | Must use the `postgresql+asyncpg://` scheme |
| `GOOGLE_CLIENT_ID` | `backend/.env` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `backend/.env` | From Google Cloud Console |
| `SESSION_SECRET_KEY` | `backend/.env` | Any random string, minimum 32 characters |
| `FRONTEND_URL` | `backend/.env` | `http://localhost:5173` for local dev |
| `BACKEND_URL` | `backend/.env` | `http://localhost:8000` for local dev |

All Dodo and PostHog variables can be left blank locally. The app degrades gracefully when they are missing.

### 4. Create the database

```bash
createdb readez
```

The backend runs `init_db()` on startup, which creates tables from SQLAlchemy models if they do not exist. There is no separate migrate step for the initial schema.

### 5. Run the app

Two terminals:

```bash
# Terminal 1 — backend
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2 — frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Sign in with Google, upload a PDF, and confirm the reader works.

## Project layout

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full breakdown. A quick map:

```
readez/
  src/                  React frontend (Vite)
    components/         Reusable UI
    pages/              Route-level pages (Landing, Library, Reader, Legal, Feedback, Subscription*)
    hooks/              Custom React hooks (useSubscription, etc.)
    lib/                API client, PDF worker config, analytics, Dodo helpers
    store/              Zustand stores
    test/               Vitest setup
  backend/
    app/
      main.py           FastAPI entry point, router registration, SPA middleware
      config.py         Pydantic settings
      database.py       Async SQLAlchemy engine and session factory
      models/           User, Book, ReadingProgress, Session, Subscription, Payment, Feedback
      routes/           auth, books, progress, subscription, payments, webhooks, feedback
      services/         storage (file I/O, signed URLs)
      middleware/       Auth dependency
    migrations/         Lightweight Python migration scripts
  docs/                 Long-form design docs, Postman collection, internal planning
  scripts/              Build-time helpers (PDF.js worker copy)
  Dockerfile            Multi-stage build: Vite frontend → FastAPI serves both
  vercel.json           Frontend-only Vercel config
  railway.toml          Single-container Railway config
```

## Running tests

```bash
npm test              # run vitest once
npm run test:ui       # open the Vitest UI
```

Current test coverage is intentionally narrow — legal pages, subscription helpers, subscription modal, feedback form. New code in critical paths (auth, uploads, payments) should come with tests where practical.

There is no backend test suite yet. If you add one, put it under `backend/tests/` and wire it up with `pytest`.

## Code style

No auto-formatter is enforced yet. Match the surrounding code:

- **Frontend:** modern React (hooks, function components), 2-space indent, single quotes, no semicolons in new files if the file already omits them.
- **Backend:** PEP 8, 4-space indent, type hints on function signatures, `async def` for anything touching the database or network.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) prefixes (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`) as used in the existing history.

Keep functions small. Prefer explicit over clever. If you reach for an abstraction, make sure it pays for itself in at least two call sites.

## Pull request process

1. Fork the repository and create a branch off `main`:

   ```bash
   git checkout -b feat/your-feature
   ```

2. Make focused commits. A PR should do one thing.

3. Run the frontend tests before pushing:

   ```bash
   npm test
   ```

4. If your change affects behavior a user can see, update the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md).

5. Push and open a PR against `main`. In the description, explain:
   - What changed and why
   - How to manually verify it (routes hit, buttons clicked, env vars set)
   - Any follow-up work you deferred

6. The maintainer (currently just me) will review. Expect questions. Small PRs get merged faster than big ones.

## Things that will get a PR rejected

- **Committing secrets.** `.env`, `.env.production`, API keys, service account JSON. If you commit one by accident, rotate it immediately, then force-push a corrected branch.
- **Committing `node_modules/`, `dist/`, `.venv/`, or `storage/`.** These are gitignored for a reason.
- **Breaking auth or payment flows without tests.** The impact is too high.
- **Large unrelated refactors bundled with a feature.** Split them.
- **New dependencies without justification.** If a two-line helper will do, write the helper.

## Working with Claude Code / AI assistants

This repo has a project-level [CLAUDE.md](CLAUDE.md) that codifies the conventions AI assistants should follow when making changes here. If you are using Claude Code, Cursor, or similar tools, point them at that file. If you add a new convention that an AI should know about, update `CLAUDE.md` in the same PR.

## Questions

Open a [Discussion](https://github.com/vaibhav-bansal/readez/discussions) or an issue. For anything security-related, follow [SECURITY.md](SECURITY.md) instead.
