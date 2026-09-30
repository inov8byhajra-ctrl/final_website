from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    # Public URL of the website. Used to build the links inside emails
    # (login link for approved CFOs, verify link for invited managers).
    FRONTEND_URL: str = "http://127.0.0.1:8000"

    # --- Email (SMTP) -------------------------------------------------------
    # Leave SMTP_HOST empty to run in DEV mode: emails are printed in the
    # server console instead of being sent, and the invite response includes
    # the OTP so you can test the full flow without a mail account.
    #
    # For Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587, SMTP_USER=<your gmail>,
    # SMTP_PASSWORD=<16-char Google "App password">, SMTP_FROM=<your gmail>
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def smtp_enabled(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASSWORD)


settings = Settings()
