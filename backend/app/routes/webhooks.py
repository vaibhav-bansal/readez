from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
import uuid
import json
import hmac
import hashlib

from app.config import get_settings
from app.database import get_db
from app.models import Subscription, Payment, SubscriptionTier, SubscriptionStatus

settings = get_settings()
router = APIRouter()


class WebhookResponse(BaseModel):
    status: str


def get_webhook_secret(webhook_type: str) -> str:
    """Get the appropriate webhook secret based on type and environment."""
    if settings.is_production:
        secrets = {
            "subscription": settings.dodo_subscription_webhook_secret,
            "payment": settings.dodo_payment_webhook_secret,
            "refund": settings.dodo_refund_webhook_secret,
        }
    else:
        secrets = {
            "subscription": settings.dodo_test_subscription_webhook_secret,
            "payment": settings.dodo_test_payment_webhook_secret,
            "refund": settings.dodo_test_refund_webhook_secret,
        }
    return secrets.get(webhook_type)


def verify_webhook_signature(body: bytes, signature: str, secret: str) -> bool:
    """Verify the webhook signature."""
    if not secret:
        return True  # Skip verification if no secret configured

    expected_signature = hmac.new(
        secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    return hmac.compare_digest(signature, expected_signature)


@router.post("/subscription", response_model=WebhookResponse)
async def handle_subscription_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Dodo Payments subscription webhooks.
    URL: /webhooks/subscription
    """
    body = await request.body()
    payload = json.loads(body)

    # Verify signature
    signature = request.headers.get("x-dodo-signature", "")
    secret = get_webhook_secret("subscription")

    if not verify_webhook_signature(body, signature, secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    event_type = payload.get("event_type") or payload.get("type")
    data = payload.get("data", payload)

    await handle_subscription_event(event_type, data, db)

    return WebhookResponse(status="ok")


@router.post("/payment", response_model=WebhookResponse)
async def handle_payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Dodo Payments payment webhooks.
    URL: /webhooks/payment
    """
    body = await request.body()
    payload = json.loads(body)

    # Verify signature
    signature = request.headers.get("x-dodo-signature", "")
    secret = get_webhook_secret("payment")

    if not verify_webhook_signature(body, signature, secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    event_type = payload.get("event_type") or payload.get("type")
    data = payload.get("data", payload)

    await handle_payment_event(event_type, data, db)

    return WebhookResponse(status="ok")


@router.post("/refund", response_model=WebhookResponse)
async def handle_refund_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle Dodo Payments refund webhooks.
    URL: /webhooks/refund
    """
    body = await request.body()
    payload = json.loads(body)

    # Verify signature
    signature = request.headers.get("x-dodo-signature", "")
    secret = get_webhook_secret("refund")

    if not verify_webhook_signature(body, signature, secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    event_type = payload.get("event_type") or payload.get("type")
    data = payload.get("data", payload)

    await handle_refund_event(event_type, data, db)

    return WebhookResponse(status="ok")


# ============ Event Handlers ============


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

    await db.commit()


async def handle_refund_event(
    event_type: str,
    data: dict,
    db: AsyncSession
):
    """
    Handle refund-related webhook events.
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
    refund_amount = data.get("refund_amount") or data.get("amount", 0)

    # Find the original payment
    result = await db.execute(
        select(Payment).where(Payment.dodo_payment_id == dodo_payment_id)
    )
    payment = result.scalar_one_or_none()

    if payment:
        payment.status = "refunded"
        payment.refund_amount = refund_amount
        payment.refunded_at = datetime.utcnow()

    # Update subscription status if refund is full
    if event_type == "refund.created" or event_type == "refund.completed":
        sub_result = await db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        subscription = sub_result.scalar_one_or_none()

        if subscription:
            subscription.status = SubscriptionStatus.CANCELLED.value
            subscription.tier = SubscriptionTier.FREE.value

    await db.commit()
