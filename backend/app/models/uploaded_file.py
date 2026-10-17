from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from app.core.database import base

class UploadedFile(base):
    __tablename__ = "uploaded_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cfo_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)  # company scope
    filename = Column(String, nullable=False)
    stored_path = Column(String, nullable=False)
    file_hash = Column(String, nullable=False, index=True)
    status = Column(String, default="pending", nullable=False)  # pending/validated/rejected/stored
    row_count = Column(Integer, default=0)
    error_message = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)