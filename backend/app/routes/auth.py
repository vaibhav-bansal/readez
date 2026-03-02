"""Authentication API routes for Google OAuth."""

import json
import secrets
import hashlib
import base64
from fastapi import APIRouter, Request, Response, Depends, HTTPException, status
from fastapi.responses import JSONResponse, HTMLResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from urllib.parse import urlencode
import uuid
from datetime import datetime
import httpx

from app.config import get_settings
from app.database import get_db
from app.models import User, Session
from app.middleware.auth import (
    get_current_user,
    set_session_cookie,
    clear_session_cookie,
    SESSION_COOKIE_NAME,
)

settings = get_settings()
router = APIRouter()

# Cookie settings
OAUTH_STATE_COOKIE = "oauth_state"
OAUTH_STATE_MAX_AGE = 600  # 10 minutes

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str]
    avatar_url: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[UserResponse] = None


class LoginResponse(BaseModel):
    authorization_url: str


def generate_pkce_verifier() -> str:
    """Generate PKCE code_verifier."""
    return secrets.token_urlsafe(64)


def generate_pkce_challenge(verifier: str) -> str:
    """Generate PKCE code_challenge from verifier (S256 method)."""
    data = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def is_secure_cookie(request: Request) -> bool:
    """Determine if Secure cookie flag should be set."""
    if request.url.scheme == "https":
        return True
    forwarded_proto = request.headers.get("x-forwarded-proto", "")
    return forwarded_proto.lower() == "https"


@router.get("/google/login", response_model=LoginResponse)
async def google_login(request: Request):
    """
    Initiate Google OAuth login.
    Returns JSON with authorization URL for popup flow.
    Frontend opens this URL in a popup window.
    """
    # Generate state and PKCE verifier
    state = secrets.token_urlsafe(32)
    code_verifier = generate_pkce_verifier()
    code_challenge = generate_pkce_challenge(code_verifier)

    # Build redirect URI
    redirect_uri = f"{settings.backend_url}/auth/google/callback"

    # Build Google OAuth URL
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "offline",
        "prompt": "select_account",
    }
    authorization_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"

    # Build response
    response = JSONResponse({"authorization_url": authorization_url})

    # Store state and verifier in a short-lived cookie
    oauth_state_data = json.dumps({
        "state": state,
        "code_verifier": code_verifier,
        "redirect_uri": redirect_uri,
    })

    secure = is_secure_cookie(request)
    response.set_cookie(
        key=OAUTH_STATE_COOKIE,
        value=oauth_state_data,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=OAUTH_STATE_MAX_AGE,
    )

    return response


@router.get("/google/callback")
async def google_callback(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle OAuth callback from Google.
    Returns HTML that posts message to parent window and sets session cookie.
    """
    # Get parameters from query
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    if error:
        return HTMLResponse(content=f"""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({{type: 'OAUTH_ERROR', error: '{error}'}}, '*');
    window.close();
</script>
</body>
</html>
        """)

    if not code:
        return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({type: 'OAUTH_ERROR', error: 'No authorization code received'}, '*');
    window.close();
</script>
</body>
</html>
        """)

    # Validate state from cookie
    oauth_state_cookie = request.cookies.get(OAUTH_STATE_COOKIE)
    if not oauth_state_cookie:
        return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({type: 'OAUTH_ERROR', error: 'Missing OAuth state'}, '*');
    window.close();
</script>
</body>
</html>
        """)

    try:
        state_data = json.loads(oauth_state_cookie)
    except json.JSONDecodeError:
        return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({type: 'OAUTH_ERROR', error: 'Invalid OAuth state'}, '*');
    window.close();
</script>
</body>
</html>
        """)

    if state_data.get("state") != state:
        return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({type: 'OAUTH_ERROR', error: 'State mismatch'}, '*');
    window.close();
</script>
</body>
</html>
        """)

    code_verifier = state_data.get("code_verifier")
    redirect_uri = state_data.get("redirect_uri")

    # Exchange code for tokens
    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "code": code,
                    "code_verifier": code_verifier,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            token_response.raise_for_status()
            token_data = token_response.json()
    except Exception as e:
        error_msg = str(e).replace("'", "\\'")
        return HTMLResponse(content=f"""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({{type: 'OAUTH_ERROR', error: '{error_msg}'}}, '*');
    window.close();
</script>
</body>
</html>
        """)

    # Decode id_token to get user info (no verification needed since it came from Google directly)
    id_token = token_data.get("id_token")
    if not id_token:
        return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({type: 'OAUTH_ERROR', error: 'No id_token in response'}, '*');
    window.close();
</script>
</body>
</html>
        """)

    # Decode JWT payload (middle part) without verification
    # We trust the token because it came from a direct HTTPS call to Google
    try:
        payload = id_token.split(".")[1]
        # Add padding if needed
        payload += "=" * (4 - len(payload) % 4)
        import base64
        user_info = json.loads(base64.urlsafe_b64decode(payload))
    except Exception as e:
        return HTMLResponse(content=f"""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({{type: 'OAUTH_ERROR', error: 'Failed to decode id_token'}}, '*');
    window.close();
</script>
</body>
</html>
        """)

    google_id = user_info.get("sub")
    email = user_info.get("email")
    name = user_info.get("name")
    picture = user_info.get("picture")

    if not google_id or not email:
        return HTMLResponse(content="""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({type: 'OAUTH_ERROR', error: 'Missing required user info'}, '*');
    window.close();
</script>
</body>
</html>
        """)

    # Find or create user
    result = await db.execute(
        select(User).where(User.google_id == google_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        result = await db.execute(
            select(User).where(User.email == email)
        )
        user = result.scalar_one_or_none()

        if user:
            user.google_id = google_id
        else:
            user = User(
                email=email,
                google_id=google_id,
                name=name,
                avatar_url=picture,
            )
            db.add(user)
    else:
        user.name = name
        user.avatar_url = picture

    await db.commit()
    await db.refresh(user)

    # Create session
    session = Session(
        user_id=user.id,
        user_agent=request.headers.get("user-agent", "")[:500],
        ip_address=request.client.host if request.client else None,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    # Build user JSON for response
    user_json = json.dumps({
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "avatar_url": user.avatar_url,
    })

    secure = is_secure_cookie(request)

    html_content = f"""
<!DOCTYPE html>
<html>
<head><title>OAuth Callback</title></head>
<body>
<script>
    window.opener.postMessage({{
        type: 'OAUTH_SUCCESS',
        user: {user_json}
    }}, '*');
    window.close();
</script>
</body>
</html>
    """

    response = HTMLResponse(content=html_content)

    # Set the session cookie
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=str(session.id),
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=30 * 24 * 60 * 60,  # 30 days
        path="/",
    )

    # Clear the oauth_state cookie
    response.delete_cookie(key=OAUTH_STATE_COOKIE)

    return response


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: User = Depends(get_current_user)
):
    """Get current authenticated user."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )


@router.get("/status", response_model=AuthStatusResponse)
async def auth_status(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Check authentication status."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)

    if not session_id:
        return AuthStatusResponse(authenticated=False)

    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        return AuthStatusResponse(authenticated=False)

    result = await db.execute(
        select(Session).where(Session.id == session_uuid)
    )
    session = result.scalar_one_or_none()

    if not session or session.is_expired():
        return AuthStatusResponse(authenticated=False)

    result = await db.execute(
        select(User).where(User.id == session.user_id)
    )
    user = result.scalar_one_or_none()

    if not user:
        return AuthStatusResponse(authenticated=False)

    return AuthStatusResponse(
        authenticated=True,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            created_at=user.created_at,
        ),
    )


@router.post("/logout")
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """Logout - delete session and clear cookie."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)

    if session_id:
        try:
            session_uuid = uuid.UUID(session_id)
            result = await db.execute(
                select(Session).where(Session.id == session_uuid)
            )
            session = result.scalar_one_or_none()
            if session:
                await db.delete(session)
                await db.commit()
        except ValueError:
            pass

    clear_session_cookie(response)
    return {"message": "Logged out successfully"}
