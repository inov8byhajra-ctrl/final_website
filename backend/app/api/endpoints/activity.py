from datetime import datetime
from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.user import User, RoleEnum, ActivityEvent, UserPresence

router = APIRouter()
ALLOWED = {"login", "logout", "upload"}


class ActivityLog(BaseModel):
    type: str = Field(max_length=20)
    file_name: str | None = Field(None, max_length=255)
    file_size: int | None = Field(None, ge=0, le=2_000_000_000)


async def _touch(db: AsyncSession, user_id: int):
    p = await db.get(UserPresence, user_id)
    if p:
        p.last_seen = datetime.utcnow()
    else:
        db.add(UserPresence(user_id=user_id, last_seen=datetime.utcnow()))


@router.post("/api/activity/log", tags=["Activity"])
@limiter.limit("60/minute")
async def log_activity(request: Request, body: ActivityLog, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == RoleEnum.admin or body.type not in ALLOWED:
        return {"ok": False}
    db.add(ActivityEvent(
        user_id=current_user.id, type=body.type,
        file_name=(body.file_name or "")[:255] or None, file_size=body.file_size,
    ))
    await _touch(db, current_user.id)
    await db.commit()
    return {"ok": True}


@router.post("/api/activity/ping", tags=["Activity"])
@limiter.limit("120/minute")
async def ping(request: Request, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if current_user.role == RoleEnum.admin:
        return {"ok": False}
    await _touch(db, current_user.id)
    await db.commit()
    return {"ok": True}