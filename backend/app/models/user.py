import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Enum
from sqlalchemy.orm import relationship
from app.core.database import base # Assuming this matches your database.py setup

class RoleEnum(str, enum.Enum):
    admin = "admin"
    cfo = "cfo"
    manager = "manager"

class User(base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(RoleEnum), nullable=False)
    
    # General Profile Fields
    name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    
    # Access Guards
    is_verified = Column(Integer, default=0) # 0 = No, 1 = Yes
    is_blocked = Column(Integer, default=0)  # 0 = No, 1 = Yes
    
    # CFO Specific Fields (Company & License Details)
    company_name = Column(String, nullable=True)
    company_domain = Column(String, nullable=True)
    trade_license_url = Column(String, nullable=True) # Ek hi page pe document/license upload ke liye
    license_number = Column(String, nullable=True)
    license_issue_date = Column(Date, nullable=True)
    license_expiry_date = Column(Date, nullable=True)
    is_approved = Column(Boolean, default=False) 
    # Admin approval ke liye
    account_expiry_date = Column(DateTime, nullable=True)
    # Manager Specific Fields
    region = Column(String, nullable=True)
    cfo_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Relationships
    managers = relationship("User", backref="cfo", remote_side=[id])

class ManagerInvitation(base):
    __tablename__ = "manager_invitations"
    
    id = Column(Integer, primary_key=True, index=True)
    cfo_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    email = Column(String, nullable=False)
    name = Column(String, nullable=False)
    region = Column(String, nullable=False)
    is_used = Column(Boolean, default=False)

    # RM (Manager) ke OTP verification ke liye
    otp_code = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)