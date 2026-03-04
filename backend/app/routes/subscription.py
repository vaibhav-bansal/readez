from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

from app.database import get_db
from app.models import User, Subscription, SubscriptionUsage, Payment
from app.middleware.auth import get_current_user

router = APIRouter()


class PaymentResponse(BaseModel):
    id: str
    dodo_payment_id: Optional[str]
    dodo_invoice_id: Optional[str]
    dodo_refund_id: Optional[str]
    amount: int
    currency: str
    status: str
    paid_at: Optional[datetime]
    refund_amount: Optional[int]
    refunded_at: Optional[datetime]
    created_at: datetime


class SubscriptionResponse(BaseModel):
    id: str
    tier: str
    status: str
    dodo_subscription_id: Optional[str]
    dodo_customer_id: Optional[str]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    cancel_at_period_end: bool
    created_at: datetime

    class Config:
        from_attributes = True


class UsageResponse(BaseModel):
    feature: str
    usage_count: int
    limit: Optional[int]
    reset_at: Optional[datetime]


class SubscriptionWithUsageResponse(BaseModel):
    subscription: Optional[SubscriptionResponse]
    usage: List[UsageResponse]
    payments: List[PaymentResponse]


# Tier limits
TIER_LIMITS = {
    "free": {
        "storage_bytes": 100 * 1024 * 1024,  # 100MB
        "books": 10,
        "ai_summaries": 3,
    },
    "pro": {
        "storage_bytes": 5 * 1024 * 1024 * 1024,  # 5GB
        "books": -1,  # unlimited
        "ai_summaries": -1,  # unlimited
    },
    "plus": {
        "storage_bytes": 25 * 1024 * 1024 * 1024,  # 25GB
        "books": -1,  # unlimited
        "ai_summaries": -1,  # unlimited
    },
}


@router.get("", response_model=SubscriptionWithUsageResponse)
async def get_subscription(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current subscription status and usage.
    """
    # Get subscription
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    subscription = result.scalar_one_or_none()

    # Get usage
    usage_result = await db.execute(
        select(SubscriptionUsage).where(SubscriptionUsage.user_id == user.id)
    )
    usage_list = usage_result.scalars().all()

    # Build usage response with limits
    tier = subscription.tier if subscription else "free"
    limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

    usage_responses = []
    for usage in usage_list:
        limit = limits.get(usage.feature, -1)
        usage_responses.append(UsageResponse(
            feature=usage.feature,
            usage_count=usage.usage_count,
            limit=limit if limit != -1 else None,
            reset_at=usage.reset_at,
        ))

    # Add missing features with 0 usage
    for feature in ["storage_bytes", "books", "ai_summaries"]:
        if not any(u.feature == feature for u in usage_responses):
            limit = limits.get(feature, -1)
            usage_responses.append(UsageResponse(
                feature=feature,
                usage_count=0,
                limit=limit if limit != -1 else None,
                reset_at=None,
            ))

    subscription_response = None
    if subscription:
        subscription_response = SubscriptionResponse(
            id=str(subscription.id),
            tier=subscription.tier,
            status=subscription.status,
            dodo_subscription_id=subscription.dodo_subscription_id,
            dodo_customer_id=subscription.dodo_customer_id,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            cancel_at_period_end=subscription.cancel_at_period_end,
            created_at=subscription.created_at,
        )

    # Get payment history
    payment_result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
    )
    payments = payment_result.scalars().all()

    payment_responses = [
        PaymentResponse(
            id=str(p.id),
            dodo_payment_id=p.dodo_payment_id,
            dodo_invoice_id=p.dodo_invoice_id,
            dodo_refund_id=p.dodo_refund_id,
            amount=p.amount,
            currency=p.currency,
            status=p.status,
            paid_at=p.paid_at,
            refund_amount=p.refund_amount,
            refunded_at=p.refunded_at,
            created_at=p.created_at,
        )
        for p in payments
    ]

    return SubscriptionWithUsageResponse(
        subscription=subscription_response,
        usage=usage_responses,
        payments=payment_responses,
    )


@router.get("/usage", response_model=List[UsageResponse])
async def get_usage(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get feature usage for the current user.
    """
    result = await db.execute(
        select(SubscriptionUsage).where(SubscriptionUsage.user_id == user.id)
    )
    usage_list = result.scalars().all()

    # Get tier limits
    sub_result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    subscription = sub_result.scalar_one_or_none()
    tier = subscription.tier if subscription else "free"
    limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])

    usage_responses = []
    for usage in usage_list:
        limit = limits.get(usage.feature, -1)
        usage_responses.append(UsageResponse(
            feature=usage.feature,
            usage_count=usage.usage_count,
            limit=limit if limit != -1 else None,
            reset_at=usage.reset_at,
        ))

    return usage_responses


async def get_user_tier(user_id: uuid.UUID, db: AsyncSession) -> str:
    """
    Helper function to get user's subscription tier.
    """
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = result.scalar_one_or_none()
    return subscription.tier if subscription and subscription.status == "active" else "free"


async def check_feature_access(
    user_id: uuid.UUID,
    feature: str,
    db: AsyncSession
) -> tuple[bool, Optional[int], Optional[int]]:
    """
    Check if user has access to a feature.
    Returns (has_access, current_usage, limit).
    """
    tier = await get_user_tier(user_id, db)
    limits = TIER_LIMITS.get(tier, TIER_LIMITS["free"])
    limit = limits.get(feature, -1)

    # Unlimited
    if limit == -1:
        return True, None, None

    # Get current usage
    result = await db.execute(
        select(SubscriptionUsage).where(
            SubscriptionUsage.user_id == user_id,
            SubscriptionUsage.feature == feature,
        )
    )
    usage = result.scalar_one_or_none()
    current_usage = usage.usage_count if usage else 0

    has_access = current_usage < limit
    return has_access, current_usage, limit


async def increment_usage(
    user_id: uuid.UUID,
    feature: str,
    db: AsyncSession
) -> bool:
    """
    Increment usage count for a feature.
    Returns True if successful, False if limit reached.
    """
    has_access, _, _ = await check_feature_access(user_id, feature, db)
    if not has_access:
        return False

    result = await db.execute(
        select(SubscriptionUsage).where(
            SubscriptionUsage.user_id == user_id,
            SubscriptionUsage.feature == feature,
        )
    )
    usage = result.scalar_one_or_none()

    if usage:
        usage.usage_count += 1
    else:
        usage = SubscriptionUsage(
            user_id=user_id,
            feature=feature,
            usage_count=1,
        )
        db.add(usage)

    await db.commit()
    return True
