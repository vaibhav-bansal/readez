from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.middleware.auth import get_current_user

settings = get_settings()
router = APIRouter()


class CheckoutRequest(BaseModel):
    tier: str  # "pro" or "plus"


class CheckoutResponse(BaseModel):
    checkout_url: str


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
        "customer": {"email": user.email},
        "return_url": f"{settings.frontend_url}/subscription/success?session_id={{CHECKOUT_SESSION_ID}}",
        "metadata": {
            "user_id": str(user.id),
            "tier": tier,
        },
    }

    # Use correct Dodo API base URL based on environment
    base_url = "https://live.dodopayments.com" if settings.is_production else "https://test.dodopayments.com"

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/checkouts",
            json=checkout_data,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

        if response.status_code not in (200, 201):
            print(f"Dodo API error: status={response.status_code}, body={response.text}")
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
