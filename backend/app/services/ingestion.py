import hashlib
import re
from pathlib import Path

import pandas as pd
from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.business_data import BusinessData

ALLOWED_EXT = {".csv", ".xls", ".xlsx"}
MODEL_COLUMNS = [c.name for c in BusinessData.__table__.columns
                 if c.name not in ("id", "upload_id", "cfo_id")]


def file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def read_file(path: Path) -> pd.DataFrame:
    ext = path.suffix.lower()
    if ext == ".csv":
        try:
            return pd.read_csv(path)
        except UnicodeDecodeError:
            return pd.read_csv(path, encoding="latin-1")  # Superstore needs this
    if ext == ".xlsx":
        return pd.read_excel(path, engine="openpyxl")
    if ext == ".xls":
        return pd.read_excel(path, engine="xlrd")
    raise ValueError(f"Unsupported file type: {ext}")


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [re.sub(r"[^a-z0-9]+", "_", str(c).strip().lower()).strip("_")
                  for c in df.columns]
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    df = normalize_columns(df)
    for col in ("order_date", "ship_date"):
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors="coerce").dt.date
            df[col] = df[col].where(pd.notna(df[col]), None)
    for col in ("sales", "quantity", "discount", "profit"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def add_derived(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    cost = df["sales"] - df["profit"]
    df["unit_cost"] = (cost / df["quantity"]).round(4)
    df["net_profit"] = df["profit"]  # TODO: replace with your own net_profit formula
    return df


async def store_rows(db: AsyncSession, df: pd.DataFrame,
                     upload_id: int, cfo_id: int, chunk: int = 2000) -> int:
    cols = [c for c in MODEL_COLUMNS if c in df.columns]
    data = df[cols].astype(object).where(df[cols].notna(), None)
    records = data.to_dict("records")
    for r in records:
        r["upload_id"] = upload_id
        r["cfo_id"] = cfo_id
        if r.get("quantity") is not None:
          r["quantity"] = int(r["quantity"])
    for i in range(0, len(records), chunk):
        await db.execute(insert(BusinessData), records[i:i + chunk])
    return len(records)