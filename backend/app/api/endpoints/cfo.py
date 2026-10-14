import json
import re
import secrets
import string
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status,
)
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, update, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.free_domains import FREE_DOMAINS
from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.limiter import limiter
from app.core.security import get_password_hash
from app.models.user import ManagerInvitation, RoleEnum, User, Notification,BlacklistedCompany
from app.schemas.user import InviteManager
from app.utils.email import manager_invite_email, send_email, admin_new_cfo_registration_email
from app.utils.websockets import notification_manager

router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "licenses"
MAX_LICENSE_BYTES = 5 * 1024 * 1024
LICENSE_SIGNATURES = {
    ".pdf": (b"%PDF",),
    ".png": (b"\x89PNG",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
}
OTP_MINUTES = 15
_email_adapter = TypeAdapter(EmailStr)


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


@router.post("/cfo/signup", tags=["CFO operation"])
@limiter.limit("10/hour")
async def cfo_signup(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    name: str = Form(...),
    phone: str = Form(""),
    company_name: str = Form(...),
    license_number: str = Form(...),
    license_issue_date: date = Form(...),
    license_expiry_date: date = Form(...),
    license_file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    email = _norm(email)
    try:
        _email_adapter.validate_python(email)
    except ValidationError:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    
    # Python-level strong password validation
    if not is_strong_password(password):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters long and contain at least one uppercase letter, one digit, and one special character (@$!%*?&)."
        )
    
    current_date = date.today()
    if license_issue_date > current_date:
        raise HTTPException(status_code=400, detail="License issue date cannot be in the future.")
    if license_expiry_date <= license_issue_date:
        raise HTTPException(status_code=400, detail="License expiry date must be after the issue date.")
    domain = email.split("@")[1]
    
    conditions = [
        func.lower(BlacklistedCompany.email) == email,
        BlacklistedCompany.license_number == license_number.strip().upper(),
    ]
    if domain not in FREE_DOMAINS:
        conditions.append(BlacklistedCompany.company_domain == domain)

    bl = await db.execute(select(BlacklistedCompany).filter(or_(*conditions)))
    if bl.scalars().first():
        raise HTTPException(status_code=403, detail="This company cannot register on InsightFlow.")

    ext = Path(license_file.filename or "").suffix.lower()
    if ext not in LICENSE_SIGNATURES:
        raise HTTPException(status_code=400, detail="License must be a PDF, JPG or PNG.")
    content = await license_file.read(MAX_LICENSE_BYTES + 1)
    if len(content) > MAX_LICENSE_BYTES:
        raise HTTPException(status_code=400, detail="License file must be 5 MB or smaller.")
    if not content.startswith(LICENSE_SIGNATURES[ext]):
        raise HTTPException(status_code=400, detail=f"The license file is not a valid {ext[1:].upper()}.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / stored_name).write_bytes(content)

    new_cfo = User(
        email=email,
        hashed_password=get_password_hash(password),
        role=RoleEnum.cfo,
        name=name.strip(),
        phone=phone.strip() or None,
        company_name=company_name.strip(),
        company_domain=domain,
        license_number=license_number.strip(),
        license_issue_date=license_issue_date,
        license_expiry_date=license_expiry_date,
        trade_license_url=f"/uploads/licenses/{stored_name}",
        is_verified=0,
        is_approved=False,
    )
    
    try:
        db.add(new_cfo)
        await db.commit()
        await db.refresh(new_cfo)
        
        # 1. Query all admin users from database
        admin_result = await db.execute(select(User).filter(User.role == RoleEnum.admin))
        admins = admin_result.scalars().all()
        
        notif_msg = f"New CFO registered: {name.strip()} ({company_name.strip()}). Please review documents."
        dashboard_url = f"{settings.FRONTEND_URL.rstrip('/')}/admin.html"

        # 2. Add in-app notifications for each admin found
        for admin in admins:
            new_notif = Notification(
                admin_id=admin.id,
                message=notif_msg,
                is_read=False
            )
            db.add(new_notif)

        await db.commit()

        # 3. Fallback mechanism: Ensure email gets dispatched even if admins list is empty or role mismatch occurs
        admin_emails = [admin.email for admin in admins if admin.email]
        if not admin_emails and getattr(settings, "FIRST_SUPERUSER", None):
            admin_emails = [settings.FIRST_SUPERUSER]

        subject, text_body, html_body = admin_new_cfo_registration_email(
            cfo_name=name.strip(),
            company=company_name.strip(),
            dashboard_url=dashboard_url
        )

        # 4. Safe email loop: Prevents a single SMTP error from rolling back the entire registration
        for admin_email in admin_emails:
            try:
                sent = await send_email(admin_email, subject, text_body, html_body)
                print(f"[Admin Email Log] Notification sent to {admin_email}: {sent}")
            except Exception as mail_err:
                print(f"[Admin Email Warning] Could not send notification to {admin_email}: {mail_err}")

    except Exception:
        (UPLOAD_DIR / stored_name).unlink(missing_ok=True)
        raise

    await notification_manager.broadcast(json.dumps({
        "type": "cfo_registered",
        "message": notif_msg,
    }))

    return {
        "message": "Registration received. You will get an email as soon as an admin approves your account.",
        "cfo_id": new_cfo.id,
    }


@router.post("/cfo/invite-manager", tags=["CFO Operation"])
@limiter.limit("30/hour")
async def invite_manager(
    request: Request,
    invite: InviteManager,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role != RoleEnum.cfo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only a CFO can invite managers.")
    if not current_user.is_approved:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is not approved yet.")
    if current_user.is_blocked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account is blocked.")
    if not current_user.company_domain:
        raise HTTPException(status_code=400, detail="Invalid CFO data. Domain missing.")

    mgr_email = _norm(invite.email)
    rm_domain = mgr_email.split("@")[1]
    if rm_domain != current_user.company_domain.lower():
        raise HTTPException(
            status_code=400,
            detail=f"Manager must use the official company email domain (@{current_user.company_domain}).",
        )

    already = await db.execute(select(User).filter(func.lower(User.email) == mgr_email))
    if already.scalars().first():
        raise HTTPException(status_code=400, detail="A user with that email already exists.")

    await db.execute(
        update(ManagerInvitation)
        .where(func.lower(ManagerInvitation.email) == mgr_email, ManagerInvitation.is_used == False)
        .values(is_used=True)
        .execution_options(synchronize_session=False)
    )

    otp_code = "".join(secrets.choice(string.digits) for _ in range(6))
    new_invite = ManagerInvitation(
        cfo_id=current_user.id,
        email=mgr_email,
        name=invite.name.strip(),
        region=invite.region.strip(),
        otp_code=otp_code,
        otp_expiry=datetime.utcnow() + timedelta(minutes=OTP_MINUTES),
    )
    db.add(new_invite)
    await db.commit()
    await db.refresh(new_invite)

    subject, text, html_body = manager_invite_email(
        name=new_invite.name,
        cfo_name=current_user.name or current_user.email,
        company=current_user.company_name or "",
        region=new_invite.region,
        otp=otp_code,
        email=mgr_email,
        minutes=OTP_MINUTES,
    )
    sent = await send_email(mgr_email, subject, text, html_body)
    if not sent:
        new_invite.is_used = True
        await db.commit()
        raise HTTPException(
            status_code=502,
            detail="The invitation could not be emailed. Please check the SMTP settings and try again.",
        )

    resp = {
        "message": "Invitation sent. A verification code has been emailed to the manager.",
        "email": mgr_email,
        "expires_in_minutes": OTP_MINUTES,
    }
    if not settings.smtp_enabled:
        resp["dev_otp"] = otp_code
    return resp