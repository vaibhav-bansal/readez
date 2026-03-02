import logging
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("=== STARTUP BEGINNING ===")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Database URL (masked): {settings.database_url[:20]}...")

    try:
        await init_db()
        logger.info("Database initialization complete")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        raise

    yield
    # Shutdown
    logger.info("=== SHUTDOWN ===")


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

logger.info("=== REGISTERING ROUTES ===")

# Health check - defined first to ensure priority
@app.get("/health")
async def health_check():
    logger.info("=== HEALTH CHECK ENDPOINT CALLED ===")
    response = {"status": "healthy", "environment": settings.environment}
    logger.info(f"Health check returning: {response}")
    return response

logger.info("Health check route registered at /health")

# Include routers
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(books_router, prefix="/books", tags=["books"])
app.include_router(progress_router, prefix="/progress", tags=["progress"])
app.include_router(subscription_router, prefix="/subscription", tags=["subscription"])
app.include_router(payments_router, prefix="/payments", tags=["payments"])
app.include_router(feedback_router, prefix="/feedback", tags=["feedback"])
app.include_router(webhooks_router, prefix="/webhooks", tags=["webhooks"])

logger.info("All API routers registered")

# Serve frontend static files (production only)
STATIC_DIR = Path("/app/static")
logger.info(f"=== CHECKING STATIC DIR ===")
logger.info(f"STATIC_DIR path: {STATIC_DIR}")
logger.info(f"STATIC_DIR exists: {STATIC_DIR.exists()}")

if STATIC_DIR.exists():
    logger.info("=== SETTING UP STATIC FILE SERVING ===")

    # Mount assets directory for JS, CSS, etc.
    assets_dir = STATIC_DIR / "assets"
    logger.info(f"Assets dir exists: {assets_dir.exists()}")
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
        logger.info("Assets directory mounted")

    # Check for index.html
    index_path = STATIC_DIR / "index.html"
    logger.info(f"index.html exists: {index_path.exists()}")

    # Catch-all route for SPA - serve index.html for non-API routes
    # Using middleware approach to avoid route conflicts
    @app.middleware("http")
    async def spa_middleware(request: Request, call_next):
        path = request.url.path
        logger.info(f"=== SPA MIDDLEWARE - Request path: {path} ===")

        # First, try the normal routing
        response = await call_next(request)
        logger.info(f"Response status: {response.status_code}")

        # If the response is 404 and it's not an API route, serve the SPA
        if response.status_code == 404:
            # Skip API routes and health check
            api_prefixes = ["/health", "/auth", "/books", "/progress", "/subscription", "/payments", "/feedback", "/webhooks", "/assets"]
            is_api_route = any(path.startswith(prefix) for prefix in api_prefixes)
            logger.info(f"Is API route: {is_api_route}")

            if not is_api_route:
                index_path = STATIC_DIR / "index.html"
                if index_path.exists():
                    logger.info(f"Serving SPA index.html for path: {path}")
                    return FileResponse(str(index_path))
                else:
                    logger.warning(f"index.html not found at {index_path}")

        return response

    logger.info("SPA middleware registered")
else:
    logger.info("STATIC_DIR does not exist - skipping static file setup")

logger.info("=== APP INITIALIZATION COMPLETE ===")
