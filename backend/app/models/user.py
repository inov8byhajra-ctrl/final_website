import enum
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Enum
from sqlalchemy.orm import relationship, backref
from app.core.database import base # Aapki base file
from datetime import datetime

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
    trade_license_url = Column(String, nullable=True) 
    license_number = Column(String, nullable=True)
    license_issue_date = Column(Date, nullable=True)
    license_expiry_date = Column(Date, nullable=True)
    is_approved = Column(Boolean, default=False) 
    account_expiry_date = Column(DateTime, nullable=True)
    
    # Manager Specific Fields
    region = Column(String, nullable=True)
    
    # ADDED: ondelete="CASCADE" 
    cfo_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    
    # ------------------ RELATIONSHIPS ------------------ #
    
    # ADDED: cascade="all, delete". Jab CFO delete hoga to uske managers (jo users hi hain) bhi delete ho jayenge.
    managers = relationship("User", backref=backref("cfo_parent", remote_side=[id]), cascade="all, delete")

    # ADDED: CFO delete ho to uski bheji hui sari invitations delete ho jayen
    invitations = relationship("ManagerInvitation", backref="cfo", cascade="all, delete-orphan")
    
    # ADDED: User/Admin delete ho to uski notifications bhi delete ho jayen
    user_notifications = relationship("Notification", backref="user", cascade="all, delete-orphan")


class ManagerInvitation(base):
    __tablename__ = "manager_invitations"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # ADDED: ondelete="CASCADE"
    cfo_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    email = Column(String, nullable=False)
    name = Column(String, nullable=False)
    region = Column(String, nullable=False)
    is_used = Column(Boolean, default=False)

    # RM (Manager) ke OTP verification ke liye
    otp_code = Column(String, nullable=True)
    otp_expiry = Column(DateTime, nullable=True)
    is_verified = Column(Boolean, default=False)
    
    
class Notification(base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # ADDED: ondelete="CASCADE"
    admin_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)