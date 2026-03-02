from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db
from app.routes import (
    auth_router,
    books_router,
    progress_router,
    subscription_router,
    payments_router,
    feedback_router,
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

# CORS configuration
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
