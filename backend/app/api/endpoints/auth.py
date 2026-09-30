import json
import mimetypes
import secrets
import string
import uuid
from datetime import datetime, date, timedelta, timezone
from pathlib import Path

from fastapi import (
    APIRouter, Depends, File, Form, HTTPException, Request, UploadFile,
    WebSocket, WebSocketDisconnect, status,
)
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from starlette.concurrency import run_in_threadpool

from app.api.dependencies import get_current_user
from app.core.config import settings
from app.core.database import AsyncSessionLocal, get_db
from app.core.limiter import limiter
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import ManagerInvitation, RoleEnum, User
from app.schemas.user import AdminApproveLicense, InviteManager, ManagerSignUp
from app.utils.email import (
    cfo_approved_email, cfo_rejected_email, manager_invite_email, send_email,
)
from app.utils.websockets import notification_manager

router = APIRouter()

# Uploaded licenses live next to the app, independent of where the server is started from.
UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "licenses"
MAX_LICENSE_BYTES = 5 * 1024 * 1024
LICENSE_SIGNATURES = {           # extension -> accepted file-header bytes
    ".pdf": (b"%PDF",),
    ".png": (b"\x89PNG",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
}
OTP_MINUTES = 15
_email_adapter = TypeAdapter(EmailStr)


# ------------------------------------------------------------------ helpers

def _norm(email: str) -> str:
    return (email or "").strip().lower()


def _require_admin(user: User) -> None:
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Admins only.")


def _cfo_dict(u: User) -> dict:
    """Public view of a CFO row for the admin dashboard (never includes the password hash)."""
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "phone": u.phone,
        "company_name": u.company_name,
        "company_domain": u.company_domain,
        "license_number": u.license_number,
        "license_issue_date": u.license_issue_date.isoformat() if u.license_issue_date else None,
        "license_expiry_date": u.license_expiry_date.isoformat() if u.license_expiry_date else None,
        "has_license_file": bool(u.trade_license_url),
        "is_approved": bool(u.is_approved),
    }


def _token_payload(user: User, token: str) -> dict:
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "name": user.name or user.company_name or user.email,
        "email": user.email,
        "domain": user.company_domain,
    }


def _to_naive_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def _ws_is_admin(token: str | None) -> bool:
    if not token:
        return False
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email = payload.get("sub")
    except JWTError:
        return False
    if not email:
        return False
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).filter(User.email == email))
        user = res.scalars().first()
    return bool(user and user.role == RoleEnum.admin and not user.is_blocked)


# ==========================================
# STAGE 1: CFO Registration & Admin Flow
# ==========================================

@router.websocket("/admin/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Live notifications for the admin dashboard. Requires ?token=<admin JWT>."""
    if not await _ws_is_admin(websocket.query_params.get("token")):
        await websocket.close(code=1008)
        return
    await notification_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket)


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
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")
    if license_expiry_date <= license_issue_date:
        raise HTTPException(status_code=400, detail="License expiry date must be after the issue date.")
    domain = email.split("@")[1]

    existing = await db.execute(select(User).filter(func.lower(User.email) == email))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="That email is already registered.")

    # --- validate the license document (extension, size and real file header)
    ext = Path(license_file.filename or "").suffix.lower()
    if ext not in LICENSE_SIGNATURES:
        raise HTTPException(status_code=400, detail="License must be a PDF, JPG or PNG.")
    content = await license_file.read(MAX_LICENSE_BYTES + 1)
    if len(content) > MAX_LICENSE_BYTES:
        raise HTTPException(status_code=400, detail="License file must be 5 MB or smaller.")
    if not content.startswith(LICENSE_SIGNATURES[ext]):
        raise HTTPException(status_code=400, detail=f"The license file is not a valid {ext[1:].upper()}.")

    # random server-side filename: no overwriting, no path tricks from the client's filename
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
    except Exception:
        (UPLOAD_DIR / stored_name).unlink(missing_ok=True)
        raise

    await notification_manager.broadcast(json.dumps({
        "type": "cfo_registered",
        "message": f"New CFO registered from {company_name.strip()} ({domain}). Please review documents.",
    }))

    return {
        "message": "Registration received. You will get an email as soon as an admin approves your account.",
        "cfo_id": new_cfo.id,
    }


@router.get("/admin/cfos", tags=["Admin Operations"])
async def admin_list_cfos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Everything the admin dashboard needs: counters + all CFOs (newest first)."""
    _require_admin(current_user)

    res = await db.execute(select(User).filter(User.role == RoleEnum.cfo).order_by(User.id.desc()))
    cfos = res.scalars().all()
    managers = (await db.execute(
        select(func.count()).select_from(User).filter(User.role == RoleEnum.manager)
    )).scalar_one()

    return {
        "stats": {
            "pending": sum(1 for c in cfos if not c.is_approved),
            "approved": sum(1 for c in cfos if c.is_approved),
            "managers": managers,
        },
        "cfos": [_cfo_dict(c) for c in cfos],
    }


@router.get("/admin/pending-cfos", tags=["Admin Operations"])
async def get_pending_cfos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    result = await db.execute(
        select(User).filter(User.role == RoleEnum.cfo, User.is_approved == False).order_by(User.id.desc())  # noqa: E712
    )
    return {"pending_cfos": [_cfo_dict(c) for c in result.scalars().all()]}


@router.get("/admin/download-license/{cfo_id}", tags=["Admin Operations"])
async def download_cfo_license(
    cfo_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

    result = await db.execute(select(User).filter(User.id == cfo_id, User.role == RoleEnum.cfo))
    cfo = result.scalars().first()
    if not cfo or not cfo.trade_license_url:
        raise HTTPException(status_code=404, detail="CFO or License Document not found")

    # only the bare filename is used -> cannot escape the uploads folder
    file_path = UPLOAD_DIR / Path(cfo.trade_license_url).name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server storage")

    media_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=media_type,
        content_disposition_type="inline",   # lets the admin view it in a browser tab
    )


@router.post("/admin/approve-license", tags=["Admin Operations"])
async def admin_approve_license(
    approval: AdminApproveLicense,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

    # role filter: an admin action can only ever touch a CFO record
    result = await db.execute(select(User).filter(User.id == approval.cfo_id, User.role == RoleEnum.cfo))
    cfo = result.scalars().first()
    if not cfo:
        raise HTTPException(status_code=404, detail="CFO not found")

    display_name = cfo.name or cfo.company_name or "there"
    cfo_email = cfo.email

    if not approval.is_valid:
        if cfo.is_approved:
            raise HTTPException(status_code=400, detail="This CFO is already approved and cannot be rejected.")
        license_name = Path(cfo.trade_license_url).name if cfo.trade_license_url else None
        await db.delete(cfo)
        await db.commit()
        if license_name:
            (UPLOAD_DIR / license_name).unlink(missing_ok=True)
        subject, text, html_body = cfo_rejected_email(display_name)
        sent = await run_in_threadpool(send_email, cfo_email, subject, text, html_body)
        return {"message": "License invalid. CFO registration rejected and removed.", "email_sent": sent}

    if cfo.is_approved:
        return {"message": "CFO was already approved.", "email_sent": False}

    cfo.is_approved = True
    cfo.is_verified = 1
    if approval.expiry_date:
        cfo.account_expiry_date = _to_naive_utc(approval.expiry_date)
    await db.commit()

    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login.html?tab=login"
    subject, text, html_body = cfo_approved_email(display_name, login_url)
    sent = await run_in_threadpool(send_email, cfo_email, subject, text, html_body)
    return {"message": "CFO approved.", "email_sent": sent}


# ==========================================
# STAGE 2: Manager Invitation & Registration
# ==========================================

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

    # a new invite replaces any older unused one for the same address (old OTPs stop working)
    await db.execute(
        update(ManagerInvitation)
        .where(func.lower(ManagerInvitation.email) == mgr_email, ManagerInvitation.is_used == False)  # noqa: E712
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
    sent = await run_in_threadpool(send_email, mgr_email, subject, text, html_body)
    if not sent:
        new_invite.is_used = True        # don't leave a live OTP nobody received
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
        resp["dev_otp"] = otp_code       # DEV MODE ONLY: never returned once real SMTP is configured
    return resp


@router.post("/manager/signup", tags=["Manager Operations"])
@limiter.limit("10/minute")
async def manager_signup(request: Request, manager_in: ManagerSignUp, db: AsyncSession = Depends(get_db)):
    email = _norm(manager_in.email)

    exists = await db.execute(select(User).filter(func.lower(User.email) == email))
    if exists.scalars().first():
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in.")

    result = await db.execute(
        select(ManagerInvitation)
        .filter(func.lower(ManagerInvitation.email) == email, ManagerInvitation.is_used == False)  # noqa: E712
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


# ==========================================
# STAGE 3: Authentication Guard Flow
# ==========================================

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
    if user.account_expiry_date and datetime.utcnow() > user.account_expiry_date:
        raise HTTPException(status_code=403, detail="Your account has expired. Please contact support.")

    token = create_access_token(data={"sub": user.email})
    return _token_payload(user, token)
