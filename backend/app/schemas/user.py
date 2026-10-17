import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.core.validators import clean_name, password_problem
from typing import Optional
from datetime import datetime,date



class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordSchema(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)

class CFOSignUp(BaseModel):
    email: EmailStr
    password: str
    company_name: str


class AdminApproveLicense(BaseModel):
    cfo_id: int
    is_valid: bool
    expiry_date: Optional[datetime] = None


class InviteManager(BaseModel):
    email: EmailStr
    name: str = Field(min_length=3, max_length=20)
    region: str = Field(min_length=3, max_length=30)

    @field_validator("name")
    @classmethod
    def _check_name(cls, v):
        return clean_name(v, "Manager name")

    @field_validator("region")
    @classmethod
    def _check_region(cls, v):
        v = v.strip()
        if not re.fullmatch(r"[A-Za-z][A-Za-z ,.\-]{1,59}", v):
            raise ValueError("Region can only contain letters, spaces and , . -")
        return v


class ManagerSignUp(BaseModel):
    email: EmailStr
    # Enforces min length in Pydantic; regex validation is handled in the endpoint logic
    password: str = Field(min_length=8, max_length=128)
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")

    @field_validator("password")
    @classmethod
    def _check_pw(cls, v):
        problem = password_problem(v)
        if problem:
            raise ValueError(problem)
        return v


class LoginCredentials(BaseModel):
    email: EmailStr
    password: str


class VerifyOTPSchema(BaseModel):
    rm_email: EmailStr
    otp_code: str
    
class BlacklistCompany(BaseModel):
    cfo_id: int
    reason: Optional[str] = None
    
# NEW
class RenewalDecision(BaseModel):
    approve: bool
    reason: Optional[str] = Field(default=None, max_length=300)


class RunExpiryCheck(BaseModel):
    as_of: Optional[date] = None        # pretend today is this date (testing)
    reset_reminders: bool = False       # clear "already sent" flags so you can re-test