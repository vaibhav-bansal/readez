# Railway Deployment Guide

This guide covers deploying the ReadEz backend to Railway with a custom domain.

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository with your code
- Custom domain (e.g., readez.xyz)
- Dodo Payments account

## 1. Create PostgreSQL Database

1. Go to Railway Dashboard
2. Click "New Project" -> "Provision PostgreSQL"
3. Note the database connection details from the "Variables" tab

The connection string format:
```
postgresql://postgres:PASSWORD@HOST:PORT/railway
```

## 2. Deploy Backend Service

### Option A: Deploy from GitHub

1. In Railway, click "Add Service" -> "GitHub Repo"
2. Select your repository
3. Railway will auto-detect the Dockerfile in `backend/`

### Option B: Deploy with railway.toml

The `railway.toml` is already configured. Just connect your repo.

### Configure Environment Variables

In Railway, go to your backend service -> Variables tab and add:

```env
# App
APP_NAME=ReadEz API
DEBUG=false
ENVIRONMENT=production

# URLs (update after setting custom domain)
FRONTEND_URL=https://readez.xyz
BACKEND_URL=https://api.readez.xyz

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
DODO_WEBHOOK_SECRET=your-live-webhook-secret
DODO_PRO_PRODUCT_ID=your-live-pro-product-id
DODO_PLUS_PRODUCT_ID=your-live-plus-product-id
```

**Important:** Link the PostgreSQL database to your backend service:
1. Go to backend service -> "New" -> "Database" -> Select your PostgreSQL
2. This automatically injects `DATABASE_URL`

## 3. Set Up Custom Domain

### Option A: Subdomain (Recommended)

Use a subdomain like `api.readez.xyz` for the backend:

1. In Railway, go to backend service -> "Settings" -> "Domains"
2. Click "Generate Domain" to get a Railway domain first
3. Then click "Add Custom Domain" and enter `api.readez.xyz`
4. Railway will provide DNS records to configure

### DNS Configuration

Add these records in your domain registrar (e.g., Namecheap, Cloudflare):

| Type  | Name | Value |
|-------|------|-------|
| CNAME | api  | your-railway-domain.up.railway.app |

### Option B: Root Domain with Path-based Routing

If using the root domain (`readez.xyz`):

1. Set up the frontend on Vercel/Netlify with the root domain
2. Use a subdomain like `api.readez.xyz` for the backend
3. Configure CORS in the backend to allow the frontend domain

## 4. Configure Google OAuth

Update your Google Cloud Console OAuth settings:

1. Go to Google Cloud Console -> APIs & Services -> Credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `https://api.readez.xyz/auth/google/callback` (production)
   - `http://localhost:8000/auth/google/callback` (development)

## 5. Configure Dodo Payments Webhook

In Dodo Payments Dashboard:

1. Go to Settings -> Webhooks
2. Add webhook URL:
   - **Production:** `https://api.readez.xyz/payments/webhook`
   - **Test:** Use ngrok for local testing

3. Ensure webhook secret matches `DODO_WEBHOOK_SECRET` in Railway variables

## 6. Deploy Frontend (Vercel)

### Environment Variables

In Vercel, add these environment variables:

```env
VITE_API_URL=https://api.readez.xyz
VITE_ENV=production
```

### Update Frontend CORS

The backend `FRONTEND_URL` should match your Vercel domain:
- If using custom domain: `https://readez.xyz`
- If using Vercel domain: `https://your-app.vercel.app`

## 7. Verify Deployment

### Health Check

```bash
curl https://api.readez.xyz/health
```

Expected response:
```json
{"status": "healthy", "environment": "production"}
```

### Test Authentication

1. Visit your frontend URL
2. Try signing in with Google
3. Check Railway logs for any errors

## 8. Storage Considerations

The backend uses local file storage (`/app/storage`). For production:

### Option A: Railway Volume (Recommended for simplicity)

1. In Railway, add a Volume to your backend service
2. Mount it to `/app/storage`
3. This persists files across deployments

### Option B: External Storage (S3, Cloudflare R2)

For better scalability, consider migrating to:
- AWS S3
- Cloudflare R2
- Supabase Storage

## Troubleshooting

### CORS Errors

- Verify `FRONTEND_URL` matches your frontend exactly
- Check that credentials are enabled in frontend API calls

### Database Connection Errors

- Ensure PostgreSQL is linked to backend service
- Check `DATABASE_URL` is set correctly

### Authentication Not Working

- Verify Google OAuth redirect URIs
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Ensure session cookies are working (HTTPS required)

### Files Not Persisting

- Add a Railway Volume mounted to `/app/storage`
- Or migrate to external storage

## Quick Reference

| Service | URL |
|---------|-----|
| Backend API | `https://api.readez.xyz` |
| Frontend | `https://readez.xyz` |
| Health Check | `https://api.readez.xyz/health` |
| Webhook | `https://api.readez.xyz/payments/webhook` |
| OAuth Callback | `https://api.readez.xyz/auth/google/callback` |
