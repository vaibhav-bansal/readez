# CLAUDE.md

Project-level instructions for Claude Code and other AI coding assistants working in this repository. These rules are specific to ReadEz and layer on top of any global instructions the user has configured.

## What ReadEz is

ReadEz is a free, open-source web PDF reader. React 19 + Vite frontend, Python FastAPI + PostgreSQL backend. Google OAuth for auth, Dodo Payments for subscriptions, PostHog for analytics, Railway for deployment. See [ARCHITECTURE.md](ARCHITECTURE.md) for the full picture.

The maintainer (`vaibhav-bansal`) is the sole developer. Code review is self-review. This means AI assistants should err on the side of explicit, readable code over clever abstractions — the reviewer has limited context budget.

## Stack rules

Match the existing stack. Do not introduce:

- **A different frontend framework.** React + Vite + React Router + Tailwind + Zustand + TanStack Query is the stack. No Next.js, no Redux, no SWR.
- **A different backend framework.** FastAPI + SQLAlchemy async + Pydantic v2 is the stack. No Flask, no Django, no sync SQLAlchemy.
- **A different ORM pattern.** All database access is async. Every `def` that touches the database must be `async def`.
- **A different CSS strategy.** Tailwind utility classes only. No CSS modules, no styled-components, no inline `style={{…}}` except for truly dynamic values (the reader's computed PDF dimensions are an accepted exception).
- **A different auth provider.** Google OAuth with PKCE is it. Do not suggest Auth.js, Clerk, Supabase Auth, or similar — we already migrated away from Supabase on purpose.

If you think the stack should change, say so in the PR description and wait for explicit approval. Do not quietly swap libraries.

## Code style

- **Frontend:** function components, hooks only. 2-space indent. Single quotes. No semicolons in files that already omit them. Match the surrounding file.
- **Backend:** PEP 8, 4-space indent, type hints on public function signatures, `async def` for IO-bound code, `def` for pure helpers. Pydantic v2 models for request/response bodies.
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). Keep the subject line under 72 characters.
- **Imports:** absolute imports in the backend (`from app.models import User`), not relative. On the frontend, match the file you are editing — most use relative imports within `src/`.
- **No emojis in code or docs** unless the user explicitly asks for them.
- **No multi-line comments or multi-paragraph docstrings.** One short line if the *why* is non-obvious. Well-named identifiers beat explanatory comments.

## Architectural constraints

These are load-bearing. Do not change them without discussion:

- **Base64 JSON PDF delivery is intentional.** `GET /books/{id}/data` returns `{ data: "base64…" }` instead of a raw PDF response. This bypasses download managers (IDM on Windows). If you "optimize" this to a file response, reading breaks for users with IDM installed. See [ARCHITECTURE.md](ARCHITECTURE.md).
- **Signed URLs are checked in addition to session auth.** Do not remove the signature verification on `/books/{id}/data` or `/books/{id}/file`. Session auth alone is not enough.
- **Reader is lazy-loaded.** `src/pages/Reader.jsx` is imported via `React.lazy()` in [src/App.jsx](src/App.jsx) because `pdfjs-dist` is heavy. Do not move the import to a static one. Do not import `pdfjs-dist` in other routes.
- **SPA fallback is middleware, not a route.** The catch-all in `backend/app/main.py` uses `@app.middleware("http")` to avoid shadowing the `/health` check. Do not replace it with `@app.get("/{path:path}")`.
- **Flush before create for foreign keys.** When creating a `Book` and a `ReadingProgress` together, flush the book first so the FK is valid. This was a real bug — do not reintroduce it.
- **PostgreSQL URL rewriting at startup.** Railway provides `postgresql://…`; `database.py` rewrites it to `postgresql+asyncpg://…`. Keep the rewrite.
- **`init_db()` creates tables but does not alter them.** Schema changes require a migration script under `backend/migrations/`. Do not rely on model edits propagating via `create_all`.
- **Dodo webhook verification uses the Standard Webhooks spec.** HMAC-SHA256 of `{webhook_id}.{webhook_timestamp}.{body}` with a base64-decoded secret. The `whsec_` prefix is stripped. Do not "simplify" this.

## Things to never do

- **Never commit secrets.** `.env`, `.env.production`, `backend/.env`. If you see one staged, stop and warn the user.
- **Never disable auth, CORS, or webhook verification** to "make it work locally". If something is broken, fix the root cause.
- **Never bypass `--no-verify` on commits** unless the user explicitly tells you to.
- **Never force-push to `main`.**
- **Never delete user data without an explicit user instruction.** `storage/`, database rows, uploaded books. These represent real user files.
- **Never add a new npm or pip dependency** without checking the existing `package.json` / `requirements.txt` first. Prefer the built-in or existing solution.
- **Never create `.md` files** unless explicitly requested. The project already has a defined set of documentation files. Do not scatter new READMEs or ad-hoc notes into the repo.
- **Never refactor unrelated code** in a bug-fix PR. One concern per commit.

## Testing

- Frontend tests run with `npm test` (Vitest + Testing Library + jsdom).
- There is no backend test suite yet. If you add one, put it under `backend/tests/` and use `pytest` + `pytest-asyncio`.
- Before claiming work is complete:
  1. Run `npm test` if you touched the frontend.
  2. Manually verify the change in the browser at `http://localhost:5173`. Type-checking and tests catch code correctness; only the browser catches feature correctness.
  3. If the change affects the reader, the library, upload, or auth, walk through the golden path end-to-end.

Do not claim "should work" without evidence. Say what you verified.

## Verification-before-completion

When reporting task completion:

- State what you ran (the exact command) and what you saw (the exact output summary).
- State what you manually tested in the browser, including which routes and which interactions.
- If you could not test the UI (no dev server, no browser, CI context), say so explicitly rather than claiming success.

## Documentation rules

- **README.md** — product-facing. Polish with care. Voice is first-person when talking about *why* ReadEz exists, neutral when documenting *how* to use it.
- **CONTRIBUTING.md** — contributor-facing. Neutral, practical.
- **ARCHITECTURE.md** — describes the current state. Update when you change request flow, add a service, or move code between layers.
- **CHANGELOG.md** — Keep a Changelog format. Update the `Unreleased` section when your change affects user-visible behavior. Never overwrite existing entries.
- **SECURITY.md** — update if you change how auth, sessions, signed URLs, webhook verification, or secrets handling works.
- **backend/README.md** — update if you change backend setup, entry points, or env variables.
- **docs/** — historical design docs and internal planning. Treat as reference, not source of truth. Do not edit unless explicitly asked.

When adding a user-visible feature, the PR should touch **at least** `CHANGELOG.md` (Unreleased section). When adding or changing an env variable, the PR should touch **both** `.env.example` files *and* the environment variable table in `CONTRIBUTING.md`.

## User's global preferences (from their CLAUDE.md)

The maintainer is not an engineer. Keep explanations in plain language, avoid jargon without explanation, and when a technical concept is necessary, explain it briefly with an analogy.

Other standing preferences:

- **Macro over micro.** Summaries, PR descriptions, and status updates should focus on outcomes ("reading progress now survives across devices"), not artifacts ("modified 4 files, added 127 lines").
- **Never assume, always ask.** Ambiguous requests get clarifying questions, not guesses. Better slow and correct than fast and wrong.
- **Use what exists.** Before writing custom code, search for a framework built-in, a popular open-source package, or an existing template. Custom code is a last resort. If you do write custom code, explain what you searched for and why the available options did not fit.
- **Code reviews.** When asked to review, rank issues by user impact, describe each with a user-facing example, list approaches, and give a recommendation with reasoning. For frontend work, also take screenshots.

## When you are uncertain

Stop and ask. The reviewer prefers a short clarifying question over an hour of undoing an assumption. Red flags that should trigger a question:

- You are about to introduce a new dependency.
- You are about to change a file in `backend/app/routes/auth.py`, `webhooks.py`, or `storage.py`.
- You are about to modify the Dockerfile, `railway.toml`, or `vercel.json`.
- You are about to touch anything in `backend/migrations/`.
- You are about to edit `.env.example` or add a new env variable.
- The task description could reasonably be interpreted more than one way.

For everything else: read the relevant file, make the smallest change that works, and explain what you did.
