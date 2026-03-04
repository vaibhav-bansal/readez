# ReadEz

A free, open-source web-based PDF reader with infinite scroll, progress tracking, and cross-device sync.

## Features

- Upload and manage PDF books with drag-and-drop
- Infinite scroll reading experience
- Automatic reading progress tracking
- Cross-device sync
- Google Sign-in authentication
- Responsive design (mobile, tablet, desktop)
- Auto-generated book cover thumbnails

## Tech Stack

**Frontend:** React 19, Vite, Tailwind CSS, Zustand, TanStack Query, react-pdf

**Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL (asyncpg)

**Auth:** Google OAuth

**Analytics:** PostHog (optional)

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL database
- Google OAuth credentials

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
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Copy the example env file and fill in your values:

```bash
cp .env.example .env
```

Key environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SESSION_SECRET_KEY` | Random secret key (min 32 chars) |
| `FRONTEND_URL` | Frontend URL (default: `http://localhost:5173`) |
| `BACKEND_URL` | Backend URL (default: `http://localhost:8000`) |

### 3. Set up the frontend

Create a `.env` file in the project root:

```env
VITE_POSTHOG_KEY=your_posthog_project_api_key       # optional
VITE_POSTHOG_HOST=https://app.posthog.com            # optional
```

### 4. Run in development

Start the backend:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

Start the frontend (in a separate terminal):

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
readez/
  src/                    # React frontend
    components/           # Reusable UI components
    pages/                # Route pages (Library, Reader, Landing, etc.)
    hooks/                # Custom React hooks
    lib/                  # Utilities (API client, PDF worker, analytics)
    store/                # Zustand state management
  backend/                # FastAPI backend
    app/
      models/             # SQLAlchemy models
      routes/             # API route handlers
      services/           # Business logic (storage, etc.)
      middleware/         # Auth middleware
      config.py           # App configuration
      database.py         # Database setup
      main.py             # FastAPI app entry point
```

## Deployment

### Docker

Build and run with Docker:

```bash
docker build -t readez .
docker run -p 8000:8000 \
  -e DATABASE_URL=your_database_url \
  -e GOOGLE_CLIENT_ID=your_client_id \
  -e GOOGLE_CLIENT_SECRET=your_client_secret \
  -e SESSION_SECRET_KEY=your_secret_key \
  -e FRONTEND_URL=https://your-domain.com \
  -e BACKEND_URL=https://your-domain.com \
  readez
```

### Railway

1. Connect your GitHub repository to Railway
2. Set the required environment variables
3. Deploy

## Contributing

Contributions are welcome! Please feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
