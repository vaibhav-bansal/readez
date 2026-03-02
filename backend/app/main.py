from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

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


# Health check
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
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Skip if it's an API route (should have been caught by routers above)
        # This catch-all only handles frontend routes
        index_path = STATIC_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))
        return {"error": "Not found"}
