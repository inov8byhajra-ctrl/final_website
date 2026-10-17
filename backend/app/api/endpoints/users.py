from fastapi import APIRouter, Depends, HTTPException, Request
from app.api.dependencies import get_current_user
from app.models.user import User, RoleEnum
import re
from datetime import datetime, timedelta
from jose import JWTError, jwt
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.limiter import limiter
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash
from app.core.validators import password_problem
from app.schemas.user import ForgotPasswordRequest, ResetPasswordSchema
from app.utils.email import send_email, _wrap, _button

router = APIRouter()

def create_reset_token(user) -> str:
    """15-min JWT; 'fp' ties the token to the current password so it dies after use."""
    expire = datetime.utcnow() + timedelta(minutes=15)
    return jwt.encode(
        {"sub": user.email, "type": "password_reset", "fp": user.hashed_password[-12:], "exp": expire},
        settings.SECRET_KEY, algorithm=settings.ALGORITHM,
    )

def decode_reset_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=400, detail="Reset link has expired or is invalid. Please request a new one.")
    if payload.get("type") != "password_reset" or not payload.get("sub"):
        raise HTTPException(status_code=400, detail="Invalid reset link.")
    return payload

@router.post("/forgot-password", tags=["General Authentication"])
@limiter.limit("5/hour")
async def forgot_password(request: Request, payload: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = payload.email.strip().lower()
    result = await db.execute(select(User).filter(func.lower(User.email) == email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="This email is not registered in our system. Please check the spelling or create a new account.",
        )
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="This account has been blocked. Please contact support.")
    if user.role == RoleEnum.cfo and not user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="Your account is still waiting for admin approval. You can reset your password after it is approved.",
        )

    token = create_reset_token(user)
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
    sent = await send_email(user.email, subject, body_text, _wrap("Password Reset Verification", html_body))
    if not sent:
        raise HTTPException(status_code=502, detail="We could not send the email right now. Please try again in a few minutes.")

    return {"message": f"A password reset link has been sent to {user.email}. It is valid for 15 minutes. Please also check your spam folder."}

   


@router.get("/verify-reset-token", tags=["General Authentication"])
async def verify_reset_link(token: str, db: AsyncSession = Depends(get_db)):
    payload = decode_reset_token(token)
    result = await db.execute(select(User).filter(func.lower(User.email) == payload["sub"].lower()))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User account no longer exists.")
    if payload.get("fp") != user.hashed_password[-12:]:
        raise HTTPException(status_code=400, detail="This reset link has already been used. Please request a new one.")
    return {"email": user.email, "name": user.name or user.email}


@router.post("/reset-password", tags=["General Authentication"])
async def reset_password(data: ResetPasswordSchema, db: AsyncSession = Depends(get_db)):
    payload = decode_reset_token(data.token)

    problem = password_problem(data.new_password)
    if problem:
        raise HTTPException(status_code=400, detail=problem)

    result = await db.execute(select(User).filter(func.lower(User.email) == payload["sub"].lower()))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if payload.get("fp") != user.hashed_password[-12:]:
        raise HTTPException(status_code=400, detail="This reset link has already been used. Please request a new one.")

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