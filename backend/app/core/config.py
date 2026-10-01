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
    # Pydantic inko automatically .env file se utha lega (case-insensitive)
    smtp_enabled: bool = False       # Maps to SMTP_ENABLED in .env
    smtp_server: str = "smtp.gmail.com" # Maps to SMTP_SERVER in .env
    SMTP_HOST: str = "smtp.gmail.com"   # Purane code ke liye
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # extra="ignore" ensures that any extra variables in .env won't crash the app
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()