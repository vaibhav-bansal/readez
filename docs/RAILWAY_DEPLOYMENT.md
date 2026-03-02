# Railway Deployment Guide

This guide covers deploying ReadEz (frontend + backend combined) to Railway with a custom domain.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with your code
- Custom domain (e.g., readez.xyz)
- Dodo Payments account

## Architecture

ReadEz runs as a single Railway service:
- **Frontend**: Static files served by FastAPI at root path (`/`)
- **Backend**: FastAPI routes at `/auth`, `/books`, `/progress`, etc.
- **Database**: PostgreSQL (separate Railway service)
- **Storage**: Railway Volume for book files

## 1. Create PostgreSQL Database

1. Go to Railway Dashboard
2. Click "New Project" -> "Provision PostgreSQL"
3. Note the database connection details from the "Variables" tab

The connection string format:
```
postgresql://postgres:PASSWORD@HOST:PORT/railway
```

## 2. Deploy Application Service

### Option A: Deploy from GitHub

1. In Railway, click "Add Service" -> "GitHub Repo"
2. Select your repository
3. Railway will auto-detect the Dockerfile at root level

### Option B: Deploy with railway.toml

The `railway.toml` is already configured. Just connect your repo.

## 3. Add Railway Volume (Required for File Storage)

1. In Railway, go to your app service -> "Volumes" tab
2. Click "Add Volume"
3. Mount path: `/app/storage`
4. This persists uploaded books across deployments

**Important:** The first deployment will automatically migrate existing books from the Docker image to the volume.

## 4. Configure Environment Variables

In Railway, go to your app service -> Variables tab and add:

```env
# App
APP_NAME=ReadEz API
DEBUG=false
ENVIRONMENT=production

# URLs (single domain now)
FRONTEND_URL=https://readez.xyz
BACKEND_URL=https://readez.xyz

# Database (Railway provides this automatically when you link PostgreSQL)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Session
SESSION_SECRET_KEY=your-random-secret-key-min-32-chars
SESSION_EXPIRE_DAYS=30

# Storage
STORAGE_PATH=/app/storage

# Dodo Payments - Live (use these for production)
DODO_API_KEY=your-live-api-key
DODO_SUBSCRIPTION_WEBHOOK_SECRET=your-live-subscription-webhook-secret
DODO_PAYMENT_WEBHOOK_SECRET=your-live-payment-webhook-secret
DODO_REFUND_WEBHOOK_SECRET=your-live-refund-webhook-secret
DODO_PRO_PRODUCT_ID=your-live-pro-product-id
DODO_PLUS_PRODUCT_ID=your-live-plus-product-id
```

**Important:** Link the PostgreSQL database to your app service:
1. Go to app service -> "New" -> "Database" -> Select your PostgreSQL
2. This automatically injects `DATABASE_URL`

## 5. Set Up Custom Domain

1. In Railway, go to app service -> "Settings" -> "Domains"
2. Click "Generate Domain" to get a Railway domain first
3. Then click "Add Custom Domain" and enter `readez.xyz`
4. Railway will provide DNS records to configure

### DNS Configuration

Add these records in your domain registrar (e.g., Namecheap, Cloudflare):

| Type  | Name | Value |
|-------|------|-------|
| CNAME | @    | your-railway-domain.up.railway.app |
| CNAME | www  | your-railway-domain.up.railway.app |

## 6. Configure Google OAuth

Update your Google Cloud Console OAuth settings:

1. Go to Google Cloud Console -> APIs & Services -> Credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `https://readez.xyz/auth/google/callback` (production)
   - `http://localhost:8000/auth/google/callback` (development)

## 7. Configure Dodo Payments Webhooks

In Dodo Payments Dashboard, configure three separate webhooks:

| Event Type | Production URL |
|------------|----------------|
| Subscription | `https://readez.xyz/webhooks/subscription` |
| Payment | `https://readez.xyz/webhooks/payment` |
| Refund | `https://readez.xyz/webhooks/refund` |

For local testing with ngrok:
| Event Type | Local URL |
|------------|-----------|
| Subscription | `https://<ngrok-id>.ngrok-free.app/webhooks/subscription` |
| Payment | `https://<ngrok-id>.ngrok-free.app/webhooks/payment` |
| Refund | `https://<ngrok-id>.ngrok-free.app/webhooks/refund` |

Ensure webhook secrets match the corresponding variables in Railway.

## 8. Verify Deployment

### Health Check

```bash
curl https://readez.xyz/health
```

Expected response:
```json
{"status": "healthy", "environment": "production"}
```

### Test Frontend

1. Visit `https://readez.xyz`
2. The React app should load

### Test Authentication

1. Try signing in with Google
2. Check Railway logs for any errors

## 9. Local Development

For local development, the frontend and backend run separately:

```bash
# Terminal 1: Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # or `.venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 2: Frontend
npm install
npm run dev
```

The frontend will proxy API requests to `http://localhost:8000` in development mode.

## Troubleshooting

### Frontend shows 404 or blank page

- Check that the Dockerfile built successfully
- Verify static files exist in `/app/static` in the container
- Check Railway logs for FastAPI startup errors

### Database Connection Errors

- Ensure PostgreSQL is linked to app service
- Check `DATABASE_URL` is set correctly

### Authentication Not Working

- Verify Google OAuth redirect URIs include your production URL
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Ensure session cookies are working (HTTPS required)

### Files Not Persisting

- Verify Railway Volume is mounted to `/app/storage`
- Check volume is attached to the service

### CORS Errors

- Should not occur in production (same origin)
- For local dev, ensure `FRONTEND_URL` is set correctly

## Quick Reference

| Service | URL |
|---------|-----|
| Application | `https://readez.xyz` |
| Health Check | `https://readez.xyz/health` |
| OAuth Callback | `https://readez.xyz/auth/google/callback` |
| Subscription Webhook | `https://readez.xyz/webhooks/subscription` |
| Payment Webhook | `https://readez.xyz/webhooks/payment` |
| Refund Webhook | `https://readez.xyz/webhooks/refund` |
