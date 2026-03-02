from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid
import json
import hmac
import hashlib

from app.config import get_settings
from app.database import get_db
from app.models import User, Subscription, Payment, SubscriptionTier, SubscriptionStatus
from app.middleware.auth import get_current_user

settings = get_settings()
router = APIRouter()


class CheckoutRequest(BaseModel):
    tier: str  # "pro" or "plus"


class CheckoutResponse(BaseModel):
    checkout_url: str


class WebhookResponse(BaseModel):
    status: str


# Product ID mapping
TIER_PRODUCT_MAP = {
    "pro": lambda: settings.dodo_pro_product_id_active,
    "plus": lambda: settings.dodo_plus_product_id_active,
}


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    request: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a Dodo Payments checkout session.
    """
    tier = request.tier.lower()
    if tier not in ["pro", "plus"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid tier. Must be 'pro' or 'plus'",
        )

    product_id = TIER_PRODUCT_MAP[tier]()
    if not product_id:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Product not configured",
        )

    # Create checkout session with Dodo Payments
    import httpx

    api_key = settings.dodo_api_key_active
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment API not configured",
        )

    checkout_data = {
        "product_cart": [
            {
                "product_id": product_id,
                "quantity": 1,
            }
        ],
        "customer_email": user.email,
        "return_url": f"{settings.frontend_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}",
        "metadata": {
            "user_id": str(user.id),
            "tier": tier,
        },
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.dodopayments.com/v1/payments",
            json=checkout_data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create checkout session: {response.text}",
            )

        data = response.json()
        checkout_url = data.get("checkout_url") or data.get("url")

        if not checkout_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No checkout URL returned",
            )

    return CheckoutResponse(checkout_url=checkout_url)


@router.post("/webhook", response_model=WebhookResponse)
async def handle_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Dodo Payments webhooks.
    """
    # Get raw body for signature verification
    body = await request.body()
    payload = json.loads(body)

    # Verify webhook signature (if configured)
    signature = request.headers.get("x-dodo-signature", "")
    webhook_secret = settings.dodo_webhook_secret_active

    if webhook_secret:
        expected_signature = hmac.new(
            webhook_secret.encode(),
            body,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature",
            )

    event_type = payload.get("event_type") or payload.get("type")
    data = payload.get("data", payload)

    # Handle subscription events
    if event_type and event_type.startswith("subscription."):
        await handle_subscription_event(event_type, data, db)
    elif event_type and event_type.startswith("payment."):
        await handle_payment_event(event_type, data, db)

    return WebhookResponse(status="ok")


async def handle_subscription_event(
    event_type: str,
    data: dict,
    db: AsyncSession
):
    """
    Handle subscription-related webhook events.
    """
    metadata = data.get("metadata", {})
    user_id_str = metadata.get("user_id")
    tier = metadata.get("tier", "pro")

    if not user_id_str:
        return

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        return

    dodo_subscription_id = data.get("subscription_id") or data.get("id")
    dodo_customer_id = data.get("customer_id")

    # Parse dates
    current_period_start = None
    current_period_end = None

    if data.get("current_period_start"):
        current_period_start = datetime.fromisoformat(
            data["current_period_start"].replace("Z", "+00:00")
        )
    if data.get("current_period_end"):
        current_period_end = datetime.fromisoformat(
            data["current_period_end"].replace("Z", "+00:00")
        )

    # Get or create subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        subscription = Subscription(
            user_id=user_id,
            tier=tier,
        )
        db.add(subscription)

    # Update based on event type
    if event_type in ["subscription.created", "subscription.active", "subscription.renewed"]:
        subscription.tier = tier
        subscription.status = SubscriptionStatus.ACTIVE.value
        subscription.dodo_subscription_id = dodo_subscription_id
        subscription.dodo_customer_id = dodo_customer_id
        subscription.current_period_start = current_period_start
        subscription.current_period_end = current_period_end

    elif event_type == "subscription.cancelled":
        subscription.status = SubscriptionStatus.CANCELLED.value
        subscription.cancel_at_period_end = True

    elif event_type == "subscription.expired":
        subscription.status = SubscriptionStatus.EXPIRED.value
        subscription.tier = SubscriptionTier.FREE.value

    elif event_type == "subscription.updated":
        subscription.dodo_subscription_id = dodo_subscription_id
        subscription.current_period_start = current_period_start
        subscription.current_period_end = current_period_end

    await db.commit()


async def handle_payment_event(
    event_type: str,
    data: dict,
    db: AsyncSession
):
    """
    Handle payment-related webhook events.
    """
    metadata = data.get("metadata", {})
    user_id_str = metadata.get("user_id")

    if not user_id_str:
        return

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        return

    dodo_payment_id = data.get("payment_id") or data.get("id")
    amount = data.get("amount", 0)
    currency = data.get("currency", "USD")

    # Get subscription for payment
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = result.scalar_one_or_none()

    # Create payment record
    payment = Payment(
        user_id=user_id,
        subscription_id=subscription.id if subscription else None,
        dodo_payment_id=dodo_payment_id,
        amount=amount,
        currency=currency,
        status="succeeded" if event_type == "payment.succeeded" else "failed",
        paid_at=datetime.utcnow() if event_type == "payment.succeeded" else None,
        webhook_data=json.dumps(data),
    )
    db.add(payment)

    if event_type == "payment.refunded":
        payment.status = "refunded"

    await db.commit()
