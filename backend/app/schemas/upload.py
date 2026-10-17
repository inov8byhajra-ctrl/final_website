from datetime import datetime
from pydantic import BaseModel, ConfigDict

class UploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    status: str
    row_count: int
    error_message: str | None = None
    uploaded_at: datetime
    uploader: str | None = None
    region: str | None = None
    