from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime


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
    password: str = Field(min_length=6, max_length=128)
    otp_code: str = Field(min_length=6, max_length=6, pattern=r"^[0-9]{6}$")


class LoginCredentials(BaseModel):
    email: EmailStr
    password: str


class VerifyOTPSchema(BaseModel):
    rm_email: EmailStr
    otp_code: str
