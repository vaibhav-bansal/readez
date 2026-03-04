from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
import uuid
import json
import hmac
import hashlib
import base64

import logging

from app.config import get_settings
from app.database import get_db
from app.models import User, Subscription, Payment, SubscriptionTier, SubscriptionStatus

logger = logging.getLogger(__name__)

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


def verify_webhook_signature(
    body: bytes, webhook_id: str, webhook_timestamp: str, signature: str, secret: str
) -> bool:
    """Verify webhook signature using Standard Webhooks spec.

    Dodo uses: HMAC-SHA256 of "{webhook_id}.{webhook_timestamp}.{body}"
    with base64-decoded secret key.
    """
    if not secret:
        return True  # Skip verification if no secret configured

    # Build the signed content: "webhook-id.webhook-timestamp.body"
    signed_content = f"{webhook_id}.{webhook_timestamp}.".encode() + body

    # Secret may have "whsec_" prefix - strip it, then base64-decode
    secret_bytes = secret.removeprefix("whsec_")
    secret_key = base64.b64decode(secret_bytes)

    expected = hmac.new(
        secret_key,
        signed_content,
        hashlib.sha256,
    ).digest()
    expected_b64 = base64.b64encode(expected).decode()

    # webhook-signature header can contain multiple signatures like "v1,<sig1> v1,<sig2>"
    for sig in signature.split(" "):
        sig_value = sig.split(",", 1)[-1]  # strip "v1," prefix
        if hmac.compare_digest(expected_b64, sig_value):
            return True

    return False


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

    # Verify signature using Standard Webhooks headers
    webhook_id = request.headers.get("webhook-id", "")
    webhook_timestamp = request.headers.get("webhook-timestamp", "")
    signature = request.headers.get("webhook-signature", "")
    secret = get_webhook_secret("subscription")

    if not verify_webhook_signature(body, webhook_id, webhook_timestamp, signature, secret):
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

    # Verify signature using Standard Webhooks headers
    webhook_id = request.headers.get("webhook-id", "")
    webhook_timestamp = request.headers.get("webhook-timestamp", "")
    signature = request.headers.get("webhook-signature", "")
    secret = get_webhook_secret("payment")

    if not verify_webhook_signature(body, webhook_id, webhook_timestamp, signature, secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    event_type = payload.get("event_type") or payload.get("type")
    data = payload.get("data", payload)

    logger.info(f"Payment webhook event: {event_type}")
    logger.info(f"Payment webhook payload: {json.dumps(payload, indent=2, default=str)}")

    try:
        await handle_payment_event(event_type, data, db)
    except Exception as e:
        logger.error(f"Payment webhook handler error: {e}", exc_info=True)
        raise

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

    # Verify signature using Standard Webhooks headers
    webhook_id = request.headers.get("webhook-id", "")
    webhook_timestamp = request.headers.get("webhook-timestamp", "")
    signature = request.headers.get("webhook-signature", "")
    secret = get_webhook_secret("refund")

    if not verify_webhook_signature(body, webhook_id, webhook_timestamp, signature, secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    event_type = payload.get("event_type") or payload.get("type")
    data = payload.get("data", payload)

    await handle_refund_event(event_type, data, db)

    return WebhookResponse(status="ok")


# ============ Helpers ============


def _parse_datetime(value: str) -> datetime | None:
    """Parse an ISO datetime string from Dodo, returning a naive UTC datetime."""
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    # Convert to naive UTC to match DB column type
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None)
    return dt


async def _resolve_user_id(data: dict, db: AsyncSession) -> uuid.UUID | None:
    """Resolve user_id from metadata or by customer email lookup."""
    # Try metadata first (set during checkout creation)
    metadata = data.get("metadata", {})
    user_id_str = metadata.get("user_id")
    if user_id_str:
        try:
            return uuid.UUID(user_id_str)
        except ValueError:
            pass

    # Fallback: look up user by customer email
    customer = data.get("customer", {})
    email = customer.get("email") if isinstance(customer, dict) else None
    if email:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            return user.id

    return None


# ============ Event Handlers ============


async def handle_subscription_event(
    event_type: str,
    data: dict,
    db: AsyncSession
):
    """Handle subscription-related webhook events."""
    user_id = await _resolve_user_id(data, db)
    if not user_id:
        logger.warning(f"Subscription webhook: could not resolve user_id, skipping")
        return

    # Verify user exists in our database
    user_result = await db.execute(select(User).where(User.id == user_id))
    if not user_result.scalar_one_or_none():
        logger.warning(f"Subscription webhook: user {user_id} not found, skipping")
        return

    metadata = data.get("metadata", {})
    tier = metadata.get("tier", "pro")

    dodo_subscription_id = data.get("subscription_id")
    dodo_customer_id = (data.get("customer", {}) or {}).get("customer_id")

    # Dodo uses previous_billing_date / next_billing_date (not current_period_*)
    period_start = _parse_datetime(
        data.get("current_period_start") or data.get("previous_billing_date")
    )
    period_end = _parse_datetime(
        data.get("current_period_end") or data.get("next_billing_date")
    )

    # Get existing subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = result.scalar_one_or_none()

    if event_type in ["subscription.active", "subscription.renewed"]:
        if not subscription:
            subscription = Subscription(user_id=user_id, tier=tier)
            db.add(subscription)
        subscription.tier = tier
        subscription.status = SubscriptionStatus.ACTIVE.value
        subscription.dodo_subscription_id = dodo_subscription_id
        subscription.dodo_customer_id = dodo_customer_id
        subscription.current_period_start = period_start
        subscription.current_period_end = period_end

    elif event_type == "subscription.updated":
        if not subscription:
            logger.warning(f"Subscription webhook: no subscription for user {user_id}, skipping update")
            return
        subscription.dodo_subscription_id = dodo_subscription_id
        subscription.current_period_start = period_start
        subscription.current_period_end = period_end

    elif event_type == "subscription.cancelled":
        if not subscription:
            logger.warning(f"Subscription webhook: no subscription for user {user_id}, skipping cancel")
            return
        subscription.status = SubscriptionStatus.CANCELLED.value
        subscription.cancel_at_period_end = True

    await db.commit()


async def handle_payment_event(
    event_type: str,
    data: dict,
    db: AsyncSession
):
    """Handle payment-related webhook events."""
    user_id = await _resolve_user_id(data, db)
    if not user_id:
        logger.warning(f"Payment webhook: could not resolve user_id, skipping")
        return

    dodo_payment_id = data.get("payment_id")
    dodo_invoice_id = data.get("invoice_id")
    amount = data.get("total_amount") or data.get("amount") or 0
    currency = data.get("currency", "USD")
    payment_status = "succeeded" if event_type == "payment.succeeded" else "failed"

    # Get subscription for linking
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = sub_result.scalar_one_or_none()

    payment = Payment(
        user_id=user_id,
        subscription_id=subscription.id if subscription else None,
        dodo_payment_id=dodo_payment_id,
        dodo_invoice_id=dodo_invoice_id,
        amount=amount,
        currency=currency,
        status=payment_status,
        paid_at=datetime.utcnow() if payment_status == "succeeded" else None,
        webhook_data=json.dumps(data),
    )
    db.add(payment)

    await db.commit()


async def handle_refund_event(
    event_type: str,
    data: dict,
    db: AsyncSession
):
    """Handle refund-related webhook events."""
    dodo_payment_id = data.get("payment_id")

    # Find the original payment
    payment = None
    if dodo_payment_id:
        result = await db.execute(
            select(Payment).where(Payment.dodo_payment_id == dodo_payment_id)
        )
        payment = result.scalar_one_or_none()

    if payment and event_type == "refund.succeeded":
        payment.status = "refunded"
        payment.dodo_refund_id = data.get("refund_id")
        payment.refund_amount = data.get("amount", 0)
        payment.refunded_at = datetime.utcnow()

        # Cancel subscription on successful refund
        sub_result = await db.execute(
            select(Subscription).where(Subscription.user_id == payment.user_id)
        )
        subscription = sub_result.scalar_one_or_none()
        if subscription:
            subscription.status = SubscriptionStatus.CANCELLED.value
            subscription.tier = SubscriptionTier.FREE.value

    await db.commit()
