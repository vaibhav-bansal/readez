# Changelog

All notable changes to ReadEz are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Nothing yet.

## [1.0.0] - 2026-04-13

First tagged release. This entry backfills the feature history from the repository's initial commits in December 2025 through April 2026. Prior to 1.0.0 there were no version tags, so everything below is grouped by theme rather than individual sub-versions.

### Reading experience

- Infinite-scroll PDF reader with single-page centered layout, keyboard navigation (arrow keys, space, Home/End, `g` for page jump), and touch/swipe gestures on mobile.
- Dynamic zoom with fit-to-height calculation based on viewport size.
- Automatic cross-device reading progress sync. Current page, scroll position within a page, and zoom level persist per book, per user.
- Lazy-loaded Reader route to keep the initial bundle small (PDF.js is heavy).
- PDF page count extraction on upload, with a lazy backfill path for books uploaded before the feature landed.
- Book cover thumbnails generated from the first page of each PDF, with a dedicated upload endpoint for user-supplied covers.
- Reading progress shown on the library page (current page / total pages).

### Accounts and auth

- Google OAuth 2.0 sign-in using PKCE (S256) and the popup flow with `postMessage` handoff.
- Server-side sessions stored in Postgres with HttpOnly, Secure, SameSite=Lax cookies and a 30-day default lifetime.
- `GET /auth/me` and `GET /auth/status` endpoints for frontend session hydration.
- Automatic account linking: existing users signing in with a new Google account get their `google_id` linked to the matching email.

### Subscriptions and payments (Dodo Payments)

- Free / Pro / Plus tier system with per-feature usage tracking (`SubscriptionUsage` model).
- Dodo Payments checkout integration for Pro and Plus tiers.
- Webhook handlers for subscription, payment, and refund events, verified using the Standard Webhooks HMAC-SHA256 spec.
- Separate test and live credentials for Dodo, selected automatically based on `ENVIRONMENT`.
- Subscription state surfaced in the UI via a `SubscriptionBadge` component and a `SubscriptionModal` for upgrade flows.
- `/subscription/success` and `/subscription/cancel` return paths after checkout.
- Feedback form accessible to all users (previously gated to authenticated users only).

### Library and uploads

- Drag-and-drop PDF upload with client-side validation and backend revalidation (`.pdf` only, max 100 MB).
- Per-user file storage on disk under `storage/books/{user_id}/`, with signed URLs for secure access and a JSON/base64 delivery path that bypasses download managers like IDM.
- Signed-URL-protected raw file endpoint (`GET /books/{book_id}/file`) and JSON data endpoint (`GET /books/{book_id}/data`).
- Public thumbnail endpoint with a 24-hour `Cache-Control: public, max-age=86400` header.
- Book delete cascades to file on disk and thumbnail.

### Marketing site and SEO

- Landing page with marketing copy, device compatibility notice, and open-source contribution callout.
- Terms & Privacy page with test coverage.
- SEO assets: `sitemap.xml`, `robots.txt`, `llms.txt`, `humans.txt`, `ai.txt`, and `.well-known/security.txt`, all served with the correct `Content-Type` headers via `vercel.json`.
- Meta tags for search engine and AI-crawler discoverability.
- Rebranded from "iReader" to "ReadEz" (favicon, copy, base URL).

### Analytics

- PostHog integration with session replays.
- Tracked events include `app_loaded`, `page_navigated`, `pdf_loaded`, `reading_progress_saved`, and `zoom_changed`. See [docs/POSTHOG_EVENTS.md](docs/POSTHOG_EVENTS.md) for the full catalog.
- Production PostHog config separated from development.

### Infrastructure and deploy

- Migrated from Supabase to a custom Python FastAPI backend. Supabase client removed from the frontend; all data access now goes through the ReadEz API.
- Single-container deploy: multi-stage Dockerfile builds the Vite frontend and bundles it into the FastAPI image, which serves static assets and the API from one process.
- Railway deployment with dynamic `PORT` binding, `/health` health check, and `ON_FAILURE` restart policy (max 3 retries).
- Vercel deployment for the frontend-only path with SPA rewrites.
- SPA routing handled via FastAPI middleware to avoid conflict with the Railway health check.
- Automatic conversion of `postgresql://` to `postgresql+asyncpg://` for Railway-provisioned Postgres URLs.
- Python installed in the Alpine frontend build stage to support `pdfjs-dist` native module compilation.

### Fixes

- Storage service bugs that caused 500 errors on upload.
- Upload error handling: clearer diagnostics when writes fail, and the book record is now flushed before `ReadingProgress` is created so the foreign key is always valid.
- SPA routing on refresh no longer 404s.
- Relative URLs used in production instead of hardcoded `localhost`.
- Removed unused `canvas` dependency.
- Removed Vercel Analytics in favor of PostHog.

### Testing and tooling

- Vitest + Testing Library setup with `jsdom`.
- Test coverage for `FeedbackForm`, `SubscriptionModal`, `Legal`, and `subscriptionHelpers`.
- Postman collection (`docs/ReadEz.postman_collection.json`) for manual API testing.

### For contributors

- Python 3.11+ backend with `pypdf` for page count extraction.
- SQLAlchemy async ORM with asyncpg driver.
- Pydantic v2 settings via `pydantic-settings`.
- Lightweight migration system under `backend/migrations/` (plain Python scripts, not Alembic).

[Unreleased]: https://github.com/vaibhav-bansal/readez/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/vaibhav-bansal/readez/releases/tag/v1.0.0
