from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt
from app.core.config import settings
from fastapi.concurrency import run_in_threadpool

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _clip(p: str) -> bytes:
    return p.encode("utf-8")[:72]          # bcrypt limit is 72 BYTES

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(_clip(plain_password), hashed_password)

def get_password_hash(password: str):
    return pwd_context.hash(_clip(password))

async def averify_password(p: str, h: str) -> bool:
    return await run_in_threadpool(verify_password, p, h)

async def ahash_password(p: str) -> str:
    return await run_in_threadpool(get_password_hash, p)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)