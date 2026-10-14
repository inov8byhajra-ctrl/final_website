import re
import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import ManagerInvitation, RoleEnum, User
from app.schemas.user import ManagerSignUp

router = APIRouter()


def is_strong_password(password: str) -> bool:
    """Validates: min 8 chars, 1 uppercase, 1 digit, 1 special symbol."""
    if len(password) < 8:
        return False
    if not re.search(r"[A-Z]", password):
        return False
    if not re.search(r"\d", password):
        return False
    if not re.search(r"[@$!%*?&]", password):
        return False
    return True


def _norm(email: str) -> str:
    return (email or "").strip().lower()


def _token_payload(user: User, token: str) -> dict:
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "name": user.name or user.company_name or user.email,
        "email": user.email,
        "domain": user.company_domain,
    }


@router.post("/manager/signup", tags=["Manager Operations"])
@limiter.limit("10/minute")
async def manager_signup(request: Request, manager_in: ManagerSignUp, db: AsyncSession = Depends(get_db)):
    if not is_strong_password(manager_in.password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long and contain at least one uppercase letter, one digit, and one special character (@$!%*?&)."
        )

    email = _norm(manager_in.email)

    exists = await db.execute(select(User).filter(func.lower(User.email) == email))
    if exists.scalars().first():
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    result = await db.execute(
        select(ManagerInvitation)
        .filter(func.lower(ManagerInvitation.email) == email, ManagerInvitation.is_used == False)
        .order_by(ManagerInvitation.id.desc())
    )
    invitation = result.scalars().first()
    if not invitation:
        raise HTTPException(status_code=400, detail="No pending invitation found for this email.")

    if not secrets.compare_digest(invitation.otp_code or "", manager_in.otp_code):
        raise HTTPException(status_code=400, detail="Invalid OTP code.")
    if not invitation.otp_expiry or datetime.utcnow() > invitation.otp_expiry:
        raise HTTPException(status_code=400, detail="OTP has expired. Ask your CFO to send a new invite.")

    cfo = await db.get(User, invitation.cfo_id)
    if not cfo or not cfo.is_approved:
        raise HTTPException(status_code=400, detail="This invitation is no longer valid.")
    if cfo.is_blocked:
        raise HTTPException(status_code=400, detail="Your company CFO account is currently blocked.")

    new_manager = User(
        email=email,
        hashed_password=get_password_hash(manager_in.password),
        role=RoleEnum.manager,
        name=invitation.name,
        region=invitation.region,
        cfo_id=invitation.cfo_id,
        company_name=cfo.company_name,
        company_domain=email.split("@")[1],
        is_verified=1,
        is_approved=True,
    )
    invitation.is_used = True
    invitation.is_verified = True
    db.add(new_manager)
    await db.commit()
    await db.refresh(new_manager)

    token = create_access_token(data={"sub": new_manager.email})
    resp = _token_payload(new_manager, token)
    resp.update({"message": "Manager registered successfully. Dashboard access granted.", "region": new_manager.region})
    return resp


@router.post("/login", tags=["General Authentication"])
@limiter.limit("20/minute")
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    email = _norm(form_data.username)
    result = await db.execute(select(User).filter(func.lower(User.email) == email))
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    if user.role == RoleEnum.cfo and not user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="Your account is pending admin approval. We will email you as soon as it is approved.",
        )
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="This account has been blocked. Please contact support.")

    if user.role == RoleEnum.manager and user.cfo_id:
        cfo = await db.get(User, user.cfo_id)
        if cfo and cfo.is_blocked:
            raise HTTPException(status_code=403, detail="Your company CFO account has been blocked. Please contact support.")

    if user.account_expiry_date and datetime.utcnow() > user.account_expiry_date:
        raise HTTPException(status_code=403, detail="Your account has expired. Please contact support.")

    token = create_access_token(data={"sub": user.email})
    return _token_payload(user, token)