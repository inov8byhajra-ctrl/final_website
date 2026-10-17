import asyncio
import mimetypes
from datetime import datetime, time, timedelta, timezone
from pathlib import Path

from fastapi import (
    APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status,
)
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from sqlalchemy import func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.free_domains import FREE_DOMAINS
from app.api.dependencies import get_current_user
from app.core.config import settings, local_now, local_tz
from app.core.validators import clean_license
from app.core.database import AsyncSessionLocal, get_db
from app.core.scheduler import run_expiry_check
from app.models.user import RoleEnum, User, Notification, BlacklistedCompany, RenewalRequest
from app.schemas.user import AdminApproveLicense, BlacklistCompany, RenewalDecision, RunExpiryCheck
from app.utils.email import (
      cfo_approved_email, cfo_rejected_email, send_email,
      renewal_approved_email, renewal_rejected_email,
  )
from app.utils.websockets import notification_manager

router = APIRouter()

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "licenses"

_bg_tasks: set = set()


def _run_expiry_check_soon(delay: int = 15) -> None:
    """Run the expiry/reminder check shortly after an approval, so a CFO whose license
    already expires within the reminder window gets the reminder right away instead of
    waiting for the next scheduled run. The delay lets the 'approved' email arrive first."""
    async def _job():
        await asyncio.sleep(delay)
        try:
            await run_expiry_check()
        except Exception as exc:
            print(f"[Expiry Check Warning] follow-up check failed: {exc}")

    task = asyncio.create_task(_job())
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)


def _require_admin(user: User) -> None:
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied. Admins only.")


def _user_dict(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "phone": u.phone,
        "role": u.role,
        "company_name": u.company_name,
        "company_domain": u.company_domain,
        "license_number": u.license_number,
        "license_issue_date": u.license_issue_date.isoformat() if u.license_issue_date else None,
        "license_expiry_date": u.license_expiry_date.isoformat() if u.license_expiry_date else None,
        "account_expiry_date": u.account_expiry_date.isoformat() if u.account_expiry_date else None,
        "has_license_file": bool(u.trade_license_url),
        "is_approved": bool(u.is_approved),
        "is_blocked": bool(u.is_blocked),
    }


def _to_account_expiry(dt: datetime | None) -> datetime | None:
    """Convert the admin-chosen expiry to the same format used everywhere else:
    naive LOCAL time (Asia/Karachi), set to the END of that day.
    (Before, UTC values were stored as-is, so expiry was ~5 hours off.)"""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(local_tz()).replace(tzinfo=None)
    return datetime.combine(dt.date(), time.max).replace(microsecond=0)


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
        res = await db.execute(select(User).filter(func.lower(User.email) == str(email).lower()))
        user = res.scalars().first()
    return bool(user and user.role == RoleEnum.admin and not user.is_blocked)


@router.websocket("/admin/ws")
async def websocket_endpoint(websocket: WebSocket):
    if not await _ws_is_admin(websocket.query_params.get("token")):
        await websocket.close(code=1008)
        return
    await notification_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket)


@router.get("/admin/cfos", tags=["Admin Operations"])
async def admin_list_cfos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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
        "test_tools": settings.ENABLE_TEST_TOOLS,
        "cfos": [_user_dict(c) for c in cfos],
    }


@router.get("/admin/pending-cfos", tags=["Admin Operations"])
async def get_pending_cfos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    result = await db.execute(
        select(User).filter(User.role == RoleEnum.cfo, User.is_approved == False).order_by(User.id.desc())
    )
    return {"pending_cfos": [_user_dict(c) for c in result.scalars().all()]}


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

    file_path = UPLOAD_DIR / Path(cfo.trade_license_url).name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server storage")

    media_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    return FileResponse(
        path=file_path,
        filename=file_path.name,
        media_type=media_type,
        content_disposition_type="inline",
    )


@router.post("/admin/approve-license", tags=["Admin Operations"])
async def admin_approve_license(
    approval: AdminApproveLicense,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

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
        sent = await send_email(cfo_email, subject, text, html_body)
        return {"message": "License invalid. CFO registration rejected and removed.", "email_sent": sent}

    if cfo.is_approved:
        return {"message": "CFO was already approved.", "email_sent": False}

    cfo.is_approved = True
    cfo.is_verified = 1
    cfo.last_reminder_days = None
    if approval.expiry_date:
        new_expiry = _to_account_expiry(approval.expiry_date)
        if new_expiry <= local_now():
            raise HTTPException(status_code=400, detail="Account expiry date must be in the future.")
        cfo.account_expiry_date = new_expiry
    elif cfo.license_expiry_date:
        cfo.account_expiry_date = datetime.combine(cfo.license_expiry_date, datetime.max.time()).replace(microsecond=0)
    await db.commit()

    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login.html?tab=login"
    subject, text, html_body = cfo_approved_email(display_name, login_url)
    sent = await send_email(cfo_email, subject, text, html_body)
    _run_expiry_check_soon()
    return {"message": "CFO approved.", "email_sent": sent}


# Replaced deletion with block/unblock feature to preserve company and manager data
@router.patch("/admin/users/{user_id}/toggle-block", tags=["Admin Operations"])
async def toggle_block_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _require_admin(current_user)

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot block your own admin account.")

    result = await db.execute(select(User).filter(User.id == user_id))
    target_user = result.scalars().first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found.")

    if target_user.role == RoleEnum.admin:
        raise HTTPException(status_code=400, detail="Cannot block another admin.")

    # An expired CFO must renew; unblocking by hand would just be undone by the scheduler
    if (
        target_user.is_blocked
        and target_user.role == RoleEnum.cfo
        and target_user.account_expiry_date
        and local_now() > target_user.account_expiry_date
    ):
        raise HTTPException(
            status_code=400,
            detail="This CFO's license has expired. They must submit a renewal request before being unblocked.",
        )

    # Toggle block status
    target_user.is_blocked = 0 if target_user.is_blocked else 1
    await db.commit()

    status_str = "blocked" if target_user.is_blocked else "unblocked"
    return {
        "message": f"User {target_user.email} has been {status_str}.",
        "is_blocked": bool(target_user.is_blocked)
    }


@router.get("/admin/notifications", tags=["Admin Operations"])
async def get_admin_notifications(
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    _require_admin(current_user)
    
    result = await db.execute(
        select(Notification).filter(
            Notification.admin_id == current_user.id, 
            Notification.is_read == False
        )
    )
    return result.scalars().all()


@router.patch("/admin/notifications/{notification_id}/read", tags=["Admin Operations"])
async def mark_notification_read(
    notification_id: int, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    _require_admin(current_user)
    
    result = await db.execute(
        select(Notification).filter(
            Notification.id == notification_id, 
            Notification.admin_id == current_user.id
        )
    )
    notif = result.scalars().first()
    
    if notif:
        notif.is_read = True
        await db.commit()
        
    return {"status": "success"}

@router.get("/admin/regional-managers", tags=["Admin Operations"])
async def get_regional_managers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

    # Fetch all users with role 'manager'
    result = await db.execute(
        select(User).filter(User.role == RoleEnum.manager).order_by(User.id.desc())
    )
    managers = result.scalars().all()

    # Format output with CFO company name details
    return [
        {
            "id": m.id,
            "name": m.name,
            "email": m.email,
            "phone": m.phone,
            "region": m.region,
            "company_name": m.company_name,
            "cfo_company_name": m.company_name,
            "cfo_id": m.cfo_id,
            "is_blocked": bool(m.is_blocked),
        }
        for m in managers
    ]
    
@router.post("/admin/blacklist", tags=["Admin Operations"])
async def blacklist_company(
    data: BlacklistCompany,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)

    res = await db.execute(select(User).filter(User.id == data.cfo_id, User.role == RoleEnum.cfo))
    cfo = res.scalars().first()
    if not cfo:
        raise HTTPException(status_code=404, detail="CFO not found")
    if cfo.is_approved:
        raise HTTPException(status_code=400, detail="Approved CFOs cannot be blacklisted. Block them instead.")

    domain = (cfo.company_domain or "").lower()
    saved_domain = None if domain in FREE_DOMAINS else domain
    license_no = (cfo.license_number or "").strip().upper()

    exists = await db.execute(
        select(BlacklistedCompany).filter(
            (func.lower(BlacklistedCompany.email) == cfo.email.lower())
            | (BlacklistedCompany.license_number == license_no)
        )
    )
    if not exists.scalars().first():
        db.add(BlacklistedCompany(
            company_name=cfo.company_name,
            company_domain=saved_domain,
            email=cfo.email.lower(),
            license_number=license_no,
            reason=data.reason,
        ))

    license_name = Path(cfo.trade_license_url).name if cfo.trade_license_url else None
    await db.delete(cfo)
    await db.commit()
    if license_name:
        (UPLOAD_DIR / license_name).unlink(missing_ok=True)

    return {"message": "Company blacklisted and registration removed."}


@router.get("/admin/blacklist", tags=["Admin Operations"])
async def list_blacklist(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    res = await db.execute(select(BlacklistedCompany).order_by(BlacklistedCompany.id.desc()))
    return res.scalars().all()


@router.delete("/admin/blacklist/{entry_id}", tags=["Admin Operations"])
async def remove_from_blacklist(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    res = await db.execute(select(BlacklistedCompany).filter(BlacklistedCompany.id == entry_id))
    entry = res.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"message": "Removed from blacklist."}


# ======================= NEW: renewals / expiry =======================

@router.get("/admin/renewals", tags=["Admin Operations"])
async def list_renewals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    res = await db.execute(
        select(RenewalRequest, User)
        .join(User, User.id == RenewalRequest.cfo_id)
        .filter(RenewalRequest.status == "pending")
        .order_by(RenewalRequest.id.desc())
    )
    return {
        "renewals": [
            {
                "id": r.id,
                "cfo_id": u.id,
                "name": u.name,
                "email": u.email,
                "company_name": u.company_name,
                "old_expiry": u.account_expiry_date.date().isoformat() if u.account_expiry_date else None,
                "license_number": r.license_number,
                "license_issue_date": r.license_issue_date.isoformat(),
                "license_expiry_date": r.license_expiry_date.isoformat(),
                "has_license_file": bool(r.trade_license_url),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r, u in res.all()
        ]
    }


@router.get("/admin/renewal-license/{req_id}", tags=["Admin Operations"])
async def download_renewal_license(
    req_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    res = await db.execute(select(RenewalRequest).filter(RenewalRequest.id == req_id))
    req = res.scalars().first()
    if not req or not req.trade_license_url:
        raise HTTPException(status_code=404, detail="Renewal license not found")
    file_path = UPLOAD_DIR / Path(req.trade_license_url).name
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found on server storage")
    media_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    return FileResponse(
        path=file_path, filename=file_path.name, media_type=media_type, content_disposition_type="inline",
    )


@router.post("/admin/renewals/{req_id}/decision", tags=["Admin Operations"])
async def decide_renewal(
    req_id: int,
    body: RenewalDecision,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    res = await db.execute(select(RenewalRequest).filter(RenewalRequest.id == req_id))
    req = res.scalars().first()
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="Pending renewal request not found.")
    cfo = await db.get(User, req.cfo_id)
    if not cfo:
        raise HTTPException(status_code=404, detail="CFO not found.")

    name = cfo.name or cfo.company_name or "there"
    base_url = settings.FRONTEND_URL.rstrip("/")

    if body.approve:
        # normalise + validate the license number (old requests may have been saved unvalidated)
        try:
            license_no = clean_license(req.license_number)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=f"{exc} Reject this request.")

        if req.license_expiry_date <= local_now().date():
            raise HTTPException(status_code=400, detail="This license has already expired. Reject the request.")

        bl = await db.execute(
            select(BlacklistedCompany).filter(
                or_(
                    func.lower(BlacklistedCompany.email) == cfo.email.lower(),
                    BlacklistedCompany.license_number == license_no,
                )
            )
        )
        if bl.scalars().first():
            raise HTTPException(status_code=400, detail="This license/company is blacklisted. Reject the request.")

        dup = await db.execute(
            select(User).filter(func.upper(User.license_number) == license_no, User.id != cfo.id)
        )
        if dup.scalars().first():
            raise HTTPException(status_code=400, detail="This license number already belongs to another account. Reject the request.")

        old_file = Path(cfo.trade_license_url).name if cfo.trade_license_url else None
        cfo.license_number = license_no
        cfo.license_issue_date = req.license_issue_date
        cfo.license_expiry_date = req.license_expiry_date
        cfo.trade_license_url = req.trade_license_url
        cfo.account_expiry_date = datetime.combine(req.license_expiry_date, datetime.max.time()).replace(microsecond=0)
        cfo.is_blocked = 0
        cfo.last_reminder_days = None
        req.status = "approved"
        req.reviewed_at = datetime.utcnow()
        await db.commit()

        if old_file and old_file != Path(req.trade_license_url or "").name:
            (UPLOAD_DIR / old_file).unlink(missing_ok=True)
        sent = await send_email(
            cfo.email, *renewal_approved_email(name, req.license_expiry_date.isoformat(), f"{base_url}/login.html?tab=login")
        )
        _run_expiry_check_soon()
        return {"message": "Renewal approved. CFO unblocked.", "email_sent": sent}

    reason = (body.reason or "").strip() or "The submitted license could not be verified."
    license_name = Path(req.trade_license_url).name if req.trade_license_url else None
    req.status = "rejected"
    req.reject_reason = reason
    req.reviewed_at = datetime.utcnow()
    req.trade_license_url = None
    await db.commit()
    if license_name:
        (UPLOAD_DIR / license_name).unlink(missing_ok=True)
    sent = await send_email(cfo.email, *renewal_rejected_email(name, reason, f"{base_url}/renew.html"))
    return {"message": "Renewal rejected. CFO stays blocked.", "email_sent": sent}


@router.get("/admin/expiring-soon", tags=["Admin Operations"])
async def expiring_soon(
    days: int = 28,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _require_admin(current_user)
    days = max(1, min(days, 365))
    now = local_now()
    res = await db.execute(
        select(User)
        .filter(
            User.role == RoleEnum.cfo,
            User.is_approved == True,
            User.account_expiry_date != None,
            User.account_expiry_date <= now + timedelta(days=days),
        )
        .order_by(User.account_expiry_date.asc())
    )
    return {
        "expiring": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "company_name": u.company_name,
                "expiry_date": u.account_expiry_date.date().isoformat(),
                "days_left": (u.account_expiry_date.date() - now.date()).days,
                "expired": now > u.account_expiry_date,
                "is_blocked": bool(u.is_blocked),
            }
            for u in res.scalars().all()
        ]
    }


@router.post("/admin/run-expiry-check", tags=["Admin Operations"])
async def admin_run_expiry_check(
    body: RunExpiryCheck,
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    if not settings.ENABLE_TEST_TOOLS:
        raise HTTPException(status_code=404, detail="Not found.")
    return await run_expiry_check(body.as_of, body.reset_reminders)