from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


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
    name: str = Field(min_length=1, max_length=120)
    region: str = Field(min_length=1, max_length=120)


class ManagerSignUp(BaseModel):
    email: EmailStr
    # Enforces min length in Pydantic; regex validation is handled in the endpoint logic
    password: str = Field(min_length=8, max_length=128)
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class LoginCredentials(BaseModel):
    email: EmailStr
    password: str


class VerifyOTPSchema(BaseModel):
    rm_email: EmailStr
    otp_code: str
    
class BlacklistCompany(BaseModel):
    cfo_id: int
    reason: Optional[str] = None