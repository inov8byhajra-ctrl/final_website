from datetime import timedelta, timezone, datetime
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # Public URL of the website
    FRONTEND_URL: str = "http://127.0.0.1:8000"

    # Admin Email Fallback
    FIRST_SUPERUSER: str = "dataengineerhaju23@gmail.com"
    ADMIN_INITIAL_PASSWORD: str = ""   # set in .env; if empty a random one is printed once at first seed

    # --- Email (SMTP) -------------------------------------------------------
    smtp_enabled: bool = False       # Maps to SMTP_ENABLED in .env
    smtp_server: str = "smtp.gmail.com" # Maps to SMTP_SERVER in .env
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # --- License expiry scheduler ---------------------------------------------
    SCHEDULER_TIMEZONE: str = "Asia/Karachi"
    SCHEDULER_HOUR: int = 0                  # default: 12 AM
    SCHEDULER_MINUTE: int = 0
    SCHEDULER_INTERVAL_MINUTES: int = 0      # >0 = run every N minutes instead (testing)
    REMINDER_DAYS: str = "28,14,7"           # comma separated
    ENABLE_TEST_TOOLS: bool = False          # admin "Run expiry check now" button

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def reminder_days(self) -> list[int]:
        try:
            days = sorted({int(x) for x in self.REMINDER_DAYS.split(",") if x.strip()})
        except ValueError:
            days = []
        return days or [7, 14, 28]

settings = Settings()


def local_tz():
    try:
        from zoneinfo import ZoneInfo
        return ZoneInfo(settings.SCHEDULER_TIMEZONE)
    except Exception:
        return timezone(timedelta(hours=5))  # fallback: Pakistan (UTC+5, no DST)


def local_now() -> datetime:
    """Current local time as a naive datetime (matches how account_expiry_date is stored)."""
    return datetime.now(local_tz()).replace(tzinfo=None)