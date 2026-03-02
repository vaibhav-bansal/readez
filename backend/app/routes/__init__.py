from app.routes.auth import router as auth_router
from app.routes.books import router as books_router
from app.routes.progress import router as progress_router
from app.routes.subscription import router as subscription_router
from app.routes.payments import router as payments_router
from app.routes.feedback import router as feedback_router
from app.routes.webhooks import router as webhooks_router

__all__ = [
    "auth_router",
    "books_router",
    "progress_router",
    "subscription_router",
    "payments_router",
    "feedback_router",
    "webhooks_router",
]
