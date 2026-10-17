from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.config import settings, local_now
from app.core.database import get_db
from app.models.user import User, RoleEnum

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def _forbidden(msg: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=msg)


async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).filter(func.lower(User.email) == email.lower()))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
    if user.is_blocked:
        raise _forbidden("This account has been blocked.")

    # admins are never affected by license expiry
    if user.role == RoleEnum.admin:
        return user

    now = local_now()

    if user.role == RoleEnum.cfo:
        if not user.is_approved:
            raise _forbidden("Your account is still pending approval.")
        if user.account_expiry_date and now > user.account_expiry_date:
            raise _forbidden("Your license has expired. Please renew it.")

    elif user.role == RoleEnum.manager and user.cfo_id:
        cfo = await db.get(User, user.cfo_id)
        if cfo is None:
            raise credentials_exception
        if cfo.is_blocked:
            raise _forbidden("Your company CFO account has been blocked.")
        if cfo.account_expiry_date and now > cfo.account_expiry_date:
            raise _forbidden("Your company's license has expired. Ask your CFO to renew it.")

    return user