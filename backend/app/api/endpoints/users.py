from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.models.user import User, RoleEnum
import re
from datetime import datetime, timedelta
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash
from app.schemas.user import ForgotPasswordRequest, ResetPasswordSchema
from app.utils.email import send_email, _wrap, _button

router = APIRouter()
STRONG_PASSWORD_REGEX = re.compile(r"^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$")

def create_reset_token(email: str) -> str:
    """Generates a secure 15-minute JWT reset token."""
    expire = datetime.utcnow() + timedelta(minutes=15)
    return jwt.encode({"sub": email, "type": "password_reset", "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_reset_token(token: str) -> str:
    """Verifies the reset token and extracts the account email."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "password_reset":
            raise HTTPException(status_code=400, detail="Invalid token type.")
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=400, detail="Invalid token payload.")
        return email
    except JWTError:
        raise HTTPException(status_code=400, detail="Reset link has expired or is invalid. Please request a new one.")


@router.post("/forgot-password", tags=["General Authentication"])
async def forgot_password(request: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = request.email.strip().lower()
    
    result = await db.execute(select(User).filter(func.lower(User.email) == email))
    user = result.scalars().first()

    success_msg = "If an account with that email exists, we have sent a password reset link to your inbox."

    if not user:
        return {"message": success_msg}

    token = create_reset_token(user.email)
    reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password.html?token={token}"

    subject = "Reset your InsightFlow password"
    body_text = f"Hi {user.name or 'there'},\n\nClick the link below to verify your email and reset your password:\n{reset_url}\n\nThis link will expire in 15 minutes."
    
    html_body = f"""
    <p>Hi <b>{user.name or 'there'}</b>,</p>
    <p>We received a request to reset your InsightFlow account password.</p>
    <p>Click the button below to verify your identity and choose a new password:</p>
    {_button(reset_url, "Verify Email & Change Password")}
    <p style="color:#888888;font-size:13px;">This link is valid for 15 minutes. If you did not request a password reset, you can safely ignore this email.</p>
    """

    await send_email(user.email, subject, body_text, _wrap("Password Reset Verification", html_body))
    return {"message": success_msg}


@router.get("/verify-reset-token", tags=["General Authentication"])
async def verify_reset_link(token: str, db: AsyncSession = Depends(get_db)):
    email = verify_reset_token(token)
    result = await db.execute(select(User).filter(func.lower(User.email) == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User account no longer exists.")
    return {"email": user.email, "name": user.name or user.email}


@router.post("/reset-password", tags=["General Authentication"])
async def reset_password(data: ResetPasswordSchema, db: AsyncSession = Depends(get_db)):
    email = verify_reset_token(data.token)
    
    if not STRONG_PASSWORD_REGEX.match(data.new_password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long and contain at least one uppercase letter, one digit, and one special character (@$!%*?&)."
        )

    result = await db.execute(select(User).filter(func.lower(User.email) == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.hashed_password = get_password_hash(data.new_password)
    await db.commit()

    return {"message": "Password updated successfully. You can now sign in with your new password."}





@router.get("/me")
def read_user_me(current_user: User = Depends(get_current_user)):
    """Used by the website to confirm a saved login is still valid and to read the user's role."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "company_name": current_user.company_name,
        "region": current_user.region,
        "is_verified": current_user.is_verified,
        "is_blocked": current_user.is_blocked,
    }


@router.get("/cfo/dashboard")
def get_cfo_dashboard(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.cfo:
        raise HTTPException(status_code=403, detail="Not authorized. CFO role required.")
    return {"message": "Welcome to CFO Dashboard"}
