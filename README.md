# ReadEz

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-20%2B-brightgreen)](https://nodejs.org)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](https://python.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

A free, open-source web-based ebook reader. Upload your PDFs, read them in a clean infinite-scroll interface, and pick up exactly where you left off on any device.

## Why I built this

I read a lot of PDFs. Textbooks, papers, long-form reports, the occasional leaked startup memo. Every existing option wanted me to either live inside one company's ecosystem, pay a subscription for features I already had, or accept a reading experience built for office work from 2003.

ReadEz is the reader I wanted: fast, clean, keyboard-friendly, cross-device, and mine. Upload a PDF, it remembers where you stopped, and the next time you open the same book on your phone it is waiting on the right page. No lock-in. No ads. The code is open — if something is broken, you can fix it.

## Features

- **Drag-and-drop PDF upload** with per-user private storage
- **Infinite-scroll reader** with keyboard shortcuts, touch gestures, and dynamic zoom
- **Cross-device reading progress sync** — page, scroll position, and zoom level
- **Google Sign-In** with server-side sessions
- **Responsive** across mobile, tablet, and desktop
- **Auto-generated book cover thumbnails** from the first PDF page
- **Optional Pro / Plus subscriptions** via Dodo Payments
- **Privacy-respecting analytics** with PostHog (opt-in, self-hostable)

## Tech Stack

**Frontend:** React 19, Vite, Tailwind CSS, Zustand, TanStack Query, react-pdf

**Backend:** Python 3.11, FastAPI, SQLAlchemy (async), PostgreSQL (asyncpg), pypdf

**Auth:** Google OAuth 2.0 with PKCE

**Payments:** Dodo Payments (optional)

**Analytics:** PostHog (optional)

**Deploy:** Railway (single container) or Vercel + separate backend

See [ARCHITECTURE.md](ARCHITECTURE.md) for how all of this fits together.

## Quick start

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL
- Google OAuth credentials ([Cloud Console](https://console.cloud.google.com))

### 1. Clone and install

```bash
git clone https://github.com/vaibhav-bansal/readez.git
cd readez
npm install
```

### 2. Set up the backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # macOS / Linux
.venv\Scripts\activate              # Windows
pip install -r requirements.txt
cp .env.example .env
```

Fill in `backend/.env` with your Postgres URL, Google OAuth credentials, and a random `SESSION_SECRET_KEY` (minimum 32 characters). Full details in [CONTRIBUTING.md](CONTRIBUTING.md#3-configure-environment-variables).

### 3. Set up the frontend

```bash
cd ..       # back to repo root
cp .env.example .env
```

PostHog and Dodo values are optional for local development.

### 4. Run it

```bash
# Terminal 1
cd backend
uvicorn app.main:app --reload --port 8000
```

```bash
# Terminal 2
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), sign in with Google, and upload a PDF.

## Documentation

| Doc | What's in it |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the frontend, backend, and data model fit together |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, code style, PR process |
| [SECURITY.md](SECURITY.md) | How to report vulnerabilities and the current security posture |
| [CHANGELOG.md](CHANGELOG.md) | What shipped in each release |
| [CLAUDE.md](CLAUDE.md) | Conventions for AI coding assistants working in this repo |
| [backend/README.md](backend/README.md) | Backend-specific setup and structure |
| [docs/POSTHOG_EVENTS.md](docs/POSTHOG_EVENTS.md) | Catalog of analytics events |
| [docs/RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md) | Railway deployment walkthrough |
| [docs/QUICKSTART.md](docs/QUICKSTART.md) | Condensed setup guide |
| [docs/ReadEz.postman_collection.json](docs/ReadEz.postman_collection.json) | Postman collection for the API |

## Deployment

### Railway (recommended)

Single-container deploy. The [Dockerfile](Dockerfile) builds the Vite frontend, bundles it into the FastAPI image, and serves both from one process.

1. Connect your GitHub repository to Railway
2. Set the environment variables listed in [backend/.env.example](backend/.env.example)
3. Railway auto-detects the Dockerfile and deploys. Healthcheck is `/health`.

See [docs/RAILWAY_DEPLOYMENT.md](docs/RAILWAY_DEPLOYMENT.md) for a step-by-step walkthrough.

### Vercel (frontend only)

The [vercel.json](vercel.json) file configures a frontend-only deploy. You will need to run the backend separately and configure CORS via `FRONTEND_URL` on the backend.

### Docker (self-hosted)

```bash
docker build -t readez .
docker run -p 8000:8000 \
  -e DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/readez \
  -e GOOGLE_CLIENT_ID=your_client_id \
  -e GOOGLE_CLIENT_SECRET=your_client_secret \
  -e SESSION_SECRET_KEY=your_32_char_secret \
  -e FRONTEND_URL=https://your-domain.com \
  -e BACKEND_URL=https://your-domain.com \
  readez
```

## Contributing

PRs are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) first — it covers setup, code style, and the PR process. For security issues, follow [SECURITY.md](SECURITY.md) instead of filing a public issue.

## License

MIT. See [LICENSE](LICENSE).
