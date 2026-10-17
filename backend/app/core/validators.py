import re
from typing import Optional

NAME_RE    = re.compile(r"^[A-Za-z]+(?: [A-Za-z]+)*$")
COMPANY_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 &.,'()\-]{1,99}$")
LICENSE_RE = re.compile(r"^[A-Z0-9][A-Z0-9\-/]{3,39}$")
PHONE_RE   = re.compile(r"^\+?\d{10,15}$")


def clean_name(value: str, label: str = "Name") -> str:
    value = re.sub(r"\s+", " ", (value or "").strip())
    if len(value) < 2:
        raise ValueError(f"{label} must be at least 2 letters.")
    if len(value) > 60:
        raise ValueError(f"{label} must be 60 characters or less.")
    if not NAME_RE.match(value):
        raise ValueError(f"{label} can only contain letters (A-Z) and spaces. Numbers and symbols are not allowed.")
    return value


def clean_company(value: str) -> str:
    value = re.sub(r"\s+", " ", (value or "").strip())
    if not COMPANY_RE.match(value):
        raise ValueError("Company name must be 2-100 characters (letters, numbers, & . , ' ( ) - only).")
    return value


def clean_license(value: str) -> str:
    raw = (value or "").strip()
    if "@" in raw:
        raise ValueError("License number cannot be an email address or contain '@'. Enter the number printed on your trade license.")
    if re.search(r"\s", raw):
        raise ValueError("License number cannot contain spaces.")
    value = raw.upper()
    if not LICENSE_RE.match(value):
        raise ValueError("License number must be 4-40 characters: letters, numbers, - or / only.")
    return value


def clean_phone(value: str) -> Optional[str]:
    value = re.sub(r"[\s\-()]", "", value or "")
    if not value:
        return None
    if not PHONE_RE.match(value):
        raise ValueError("Phone number must be 10-15 digits (optionally starting with +).")
    return value


def password_problem(p: str) -> str:
    """Single password rule for signup, manager signup and reset. '' = OK."""
    if len(p) < 8:
        return "Password must be at least 8 characters long."
    if len(p.encode("utf-8")) > 72:
        return "Password is too long (max 72 characters)."
    if " " in p:
        return "Password cannot contain spaces."
    if not re.search(r"[A-Z]", p):
        return "Password must contain at least one uppercase letter (A-Z)."
    if not re.search(r"\d", p):
        return "Password must contain at least one number (0-9)."
    if not re.search(r"[@$!%*?&]", p):
        return "Password must contain at least one symbol: @ $ ! % * ? &"
    return ""