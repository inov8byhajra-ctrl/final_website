from datetime import date, datetime, time, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import delete, update
from sqlalchemy.future import select

from app.core.config import settings, local_tz, local_now
from app.core.database import AsyncSessionLocal
from app.models.user import User, RoleEnum, ManagerInvitation, Notification
from app.utils.email import send_email, license_reminder_email, license_expired_email
scheduler = AsyncIOScheduler(timezone=local_tz())


async def _mail(to: str, parts: tuple) -> bool:
    """Send an email. `parts` is the tuple returned by an email builder, e.g. (subject, html).
    Returns True on success, False on failure."""
    try:
        # send_email() does NOT raise when sending fails: it returns False.
        # Returning that value is what makes a failed reminder retry on the next run.
        return bool(await send_email(to, *parts))
    except Exception as e:
        print(f"[Expiry Email Warning] Could not send to {to}: {e}")
        return False


async def run_expiry_check(as_of: date | None = None, reset_reminders: bool = False) -> dict:
    """Send 28/14/7-day reminders and block expired CFOs.
    as_of = fake 'today' for testing. Only the most urgent reminder is sent, once per account."""
    now = datetime.combine(as_of, time.min) if as_of else local_now()
    renew_url = f"{settings.FRONTEND_URL.rstrip('/')}/renew.html"
    reminders_sent = blocked_count = 0

    async with AsyncSessionLocal() as db:
        if reset_reminders:
            await db.execute(
                update(User).where(User.role == RoleEnum.cfo).values(last_reminder_days=None)
                .execution_options(synchronize_session=False)
            )
            await db.commit()

        res = await db.execute(
            select(User).filter(
                User.role == RoleEnum.cfo,
                User.is_approved == True,
                User.account_expiry_date != None,
            )
        )
        for u in res.scalars().all():
            exp = u.account_expiry_date
            name = u.name or u.company_name or "there"

            # 1. Handle Expired Accounts
            if now > exp:
                if not u.is_blocked:
                    u.is_blocked = 1
                    blocked_count += 1
                    # Send expired email once blocked
                    await _mail(u.email, license_expired_email(name, renew_url))
                continue  # Skip reminder logic for expired accounts

            # 2. Skip blocked accounts
            if u.is_blocked:
                continue

            # 3. Calculate remaining days & target reminder interval
            days_left = (exp.date() - now.date()).days
            due = [d for d in settings.reminder_days if days_left <= d]
            if not due:
                continue

            target = min(due)
            if u.last_reminder_days is not None and u.last_reminder_days <= target:
                continue  # This (or a more urgent) reminder was already sent

            # 4. Send reminder email
            ok = await _mail(
                u.email,
                license_reminder_email(name, days_left, exp.date().isoformat(), renew_url),
            )
            if not ok:
                continue  # Email failed; retry on next run

            u.last_reminder_days = target
            reminders_sent += 1

        await db.commit()

    return {"as_of": now.date().isoformat(), "reminders_sent": reminders_sent, "blocked": blocked_count}


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
    if settings.SCHEDULER_INTERVAL_MINUTES > 0:
        scheduler.add_job(
            run_expiry_check, "interval",
            minutes=settings.SCHEDULER_INTERVAL_MINUTES, id="expiry_check", coalesce=True,
        )
    else:
        scheduler.add_job(
            run_expiry_check, "cron",
            hour=settings.SCHEDULER_HOUR, minute=settings.SCHEDULER_MINUTE,
            id="expiry_check", coalesce=True, misfire_grace_time=3600,
        )
    # also run once at server start so a missed night is not lost
    scheduler.add_job(run_expiry_check, id="expiry_startup")
    scheduler.add_job(clean_old_invitations, "cron", hour=3, minute=0, id="clean_invites")
    scheduler.add_job(clean_read_notifications, "cron", day_of_week="sun", hour=4, id="clean_notifs")
    scheduler.start()