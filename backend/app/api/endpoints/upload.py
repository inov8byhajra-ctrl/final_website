from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.valid_f1 import validate_contract
from app.models.uploaded_file import UploadedFile
from app.models.user import RoleEnum, User
from app.schemas.upload import UploadResponse
from app.services import ingestion

router = APIRouter(prefix="/api/upload", tags=["Data Ingestion"])

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads" / "data"
MAX_SIZE = 20 * 1024 * 1024  # 20 MB


def _company_id(user: User) -> int:
    return user.id if user.role == RoleEnum.cfo else user.cfo_id


@router.post("", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != RoleEnum.cfo:
        raise HTTPException(403, "Only CFO accounts can upload data.")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ingestion.ALLOWED_EXT:
        raise HTTPException(400, "Only .csv, .xls and .xlsx files are allowed.")

    content = await file.read()
    if not content:
        raise HTTPException(400, "File is empty.")
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "File too large (max 20 MB).")

    cfo_id = _company_id(user)
    fhash = ingestion.file_hash(content)

    dup = await db.execute(
        select(UploadedFile).where(
            UploadedFile.cfo_id == cfo_id,
            UploadedFile.file_hash == fhash,
            UploadedFile.status == "stored",
        )
    )
    if dup.scalars().first():
        raise HTTPException(409, "This file was already uploaded.")

    # save file
    folder = UPLOAD_DIR / str(cfo_id)
    folder.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename).name.replace(" ", "_")
    path = folder / f"{fhash[:12]}_{safe_name}"
    path.write_bytes(content)

    record = UploadedFile(
        user_id=user.id, cfo_id=cfo_id, filename=file.filename,
        stored_path=str(path), file_hash=fhash, status="pending",
    )
    db.add(record)
    await db.commit()          # keep the record even if later steps fail
    upload_id = record.id

    try:
        df = await run_in_threadpool(ingestion.read_file, path)
        df = ingestion.clean(df)
        errors = validate_contract(df)
        if errors:
            record.status = "rejected"
            record.error_message = " | ".join(errors)[:1000]
            await db.commit()
            raise HTTPException(422, detail={"errors": errors})

        df = ingestion.add_derived(df)
        count = await ingestion.store_rows(db, df, upload_id, cfo_id)
        record.status = "stored"
        record.row_count = count
        await db.commit()
        return record

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        rec = await db.get(UploadedFile, upload_id)
        rec.status = "rejected"
        rec.error_message = f"Processing failed: {e}"[:1000]
        await db.commit()
        raise HTTPException(400, f"Could not process file: {e}")


@router.get("", response_model=list[UploadResponse])
async def list_uploads(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in (RoleEnum.cfo, RoleEnum.manager):
        raise HTTPException(403, "Not allowed.")
    res = await db.execute(
        select(UploadedFile)
        .where(UploadedFile.cfo_id == _company_id(user))
        .order_by(UploadedFile.uploaded_at.desc())
    )
    return res.scalars().all()