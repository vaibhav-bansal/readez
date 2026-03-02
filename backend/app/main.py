from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.config import get_settings
from app.database import init_db
from app.routes import (
    auth_router,
    books_router,
    progress_router,
    subscription_router,
    payments_router,
    feedback_router,
    webhooks_router,
)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    yield
    # Shutdown
    pass


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    debug=settings.debug,
)

# CORS configuration (needed for local development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health check - defined first to ensure priority
@app.get("/health")
async def health_check():
    return {"status": "healthy", "environment": settings.environment}


# Include routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(books_router, prefix="/books", tags=["books"])
app.include_router(progress_router, prefix="/progress", tags=["progress"])
app.include_router(subscription_router, prefix="/subscription", tags=["subscription"])
app.include_router(payments_router, prefix="/payments", tags=["payments"])
app.include_router(feedback_router, prefix="/feedback", tags=["feedback"])
app.include_router(webhooks_router, prefix="/webhooks", tags=["webhooks"])


# Serve frontend static files (production only)
STATIC_DIR = Path("/app/static")
if STATIC_DIR.exists():
    # Mount assets directory for JS, CSS, etc.
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    # Catch-all route for SPA - serve index.html for non-API routes
    # Using middleware approach to avoid route conflicts
    @app.middleware("http")
    async def spa_middleware(request: Request, call_next):
        # First, try the normal routing
        response = await call_next(request)

        # If the response is 404 and it's not an API route, serve the SPA
        if response.status_code == 404:
            path = request.url.path

            # Skip API routes and health check
            api_prefixes = ["/health", "/auth", "/books", "/progress", "/subscription", "/payments", "/feedback", "/webhooks", "/assets"]
            if not any(path.startswith(prefix) for prefix in api_prefixes):
                index_path = STATIC_DIR / "index.html"
                if index_path.exists():
                    return FileResponse(str(index_path))

        return response
