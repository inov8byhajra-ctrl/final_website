import secrets
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings, local_now
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import ManagerInvitation, RoleEnum, User
from app.schemas.user import ManagerSignUp

router = APIRouter()


MAX_OTP_ATTEMPTS = 5
_DUMMY_HASH = get_password_hash("dummy-password")  # equalises login timing for unknown emails


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

    if (invitation.otp_attempts or 0) >= MAX_OTP_ATTEMPTS:
        invitation.is_used = True
        await db.commit()
        raise HTTPException(status_code=400, detail="Too many wrong attempts. Ask your CFO to send a new invite.")

    if not secrets.compare_digest(invitation.otp_code or "", manager_in.otp_code):
        invitation.otp_attempts = (invitation.otp_attempts or 0) + 1
        locked = invitation.otp_attempts >= MAX_OTP_ATTEMPTS
        if locked:
            invitation.is_used = True
        await db.commit()
        if locked:
            raise HTTPException(status_code=400, detail="Too many wrong attempts. Ask your CFO to send a new invite.")
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

    if not user:
        verify_password(form_data.password, _DUMMY_HASH)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")

    now = local_now()
    renew_url = f"{settings.FRONTEND_URL.rstrip('/')}/renew.html"

    if user.role == RoleEnum.cfo and not user.is_approved:
        raise HTTPException(
            status_code=403,
            detail="Your account is pending admin approval. We will email you as soon as it is approved.",
        )
    # expired CFO license -> tell them to renew (checked before the generic blocked message)
    if user.role == RoleEnum.cfo and user.account_expiry_date and now > user.account_expiry_date:
        raise HTTPException(status_code=403, detail=f"Your license expired. Renew it here: {renew_url}")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="This account has been blocked. Please contact support.")

    if user.role == RoleEnum.manager and user.cfo_id:
        cfo = await db.get(User, user.cfo_id)
        if cfo:
            cfo_expired = bool(cfo.account_expiry_date and now > cfo.account_expiry_date)
            if cfo_expired:
                raise HTTPException(
                    status_code=403,
                    detail="Your company's license has expired. Ask your CFO to renew it to restore access.",
                )
            if cfo.is_blocked:
                raise HTTPException(status_code=403, detail="Your company CFO account has been blocked. Please contact support.")

    if user.account_expiry_date and now > user.account_expiry_date:
        raise HTTPException(status_code=403, detail="Your account has expired. Please contact support.")

    token = create_access_token(data={"sub": user.email})
    return _token_payload(user, token)