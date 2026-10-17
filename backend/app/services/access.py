from sqlalchemy import select
from app.models.business_data import BusinessData
from app.models.uploaded_file import UploadedFile
from app.models.user import RoleEnum


def data_scope(user):
    """Condition for BusinessData rows this user may see."""
    if user.role == RoleEnum.cfo:
        return BusinessData.cfo_id == user.id          # CFO: everything
    return BusinessData.upload_id.in_(                 # manager: own uploads only
        select(UploadedFile.id).where(UploadedFile.user_id == user.id)
    )