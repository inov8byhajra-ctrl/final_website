from datetime import datetime, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import delete
from sqlalchemy.future import select

from app.core.database import AsyncSessionLocal
from app.models.user import User, RoleEnum, ManagerInvitation, Notification

scheduler = AsyncIOScheduler()


async def block_expired_accounts():
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(User).filter(
                User.account_expiry_date != None,
                User.account_expiry_date < datetime.utcnow(),
                User.is_blocked == 0,
                User.role != RoleEnum.admin,
            )
        )
        for u in res.scalars().all():
            u.is_blocked = 1
        await db.commit()


async def clean_old_invitations():
    cutoff = datetime.utcnow() - timedelta(days=7)
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(ManagerInvitation).where(
                (ManagerInvitation.is_used == True) | (ManagerInvitation.otp_expiry < cutoff)
            )
        )
        await db.commit()


async def clean_read_notifications():
    cutoff = datetime.utcnow() - timedelta(days=30)
    async with AsyncSessionLocal() as db:
        await db.execute(
            delete(Notification).where(Notification.is_read == True, Notification.created_at < cutoff)
        )
        await db.commit()


def start_scheduler():
    scheduler.add_job(block_expired_accounts, "cron", hour=2, minute=0, id="block_expired")
    scheduler.add_job(clean_old_invitations, "cron", hour=3, minute=0, id="clean_invites")
    scheduler.add_job(clean_read_notifications, "cron", day_of_week="sun", hour=4, id="clean_notifs")
    scheduler.start()