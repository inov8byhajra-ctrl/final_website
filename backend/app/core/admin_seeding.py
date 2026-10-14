from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.user import User, RoleEnum
from app.core.security import get_password_hash

async def create_default_admin(db: AsyncSession):
    # Check karein ke kya admin pehle se mojood hai
    result = await db.execute(select(User).filter(User.role == RoleEnum.admin))
    admin_user = result.scalars().first()
    
    if not admin_user:
        hashed_pwd = get_password_hash("admin123")
        db_admin = User(
            email="dataengineerhaju23@gmail.com",  # <-- Real email updated
            hashed_password=hashed_pwd,
            role=RoleEnum.admin,
            is_verified=1,
            is_blocked=0,
            company_name="InsightFlow Admin Panel"
        )
        db.add(db_admin)
        await db.commit()
        print(" Default Admin user successfully created!")
    else:
        # Existing admin ka email bhi real email par update kar dein
        if admin_user.email != "dataengineerhaju23@gmail.com":
            admin_user.email = "dataengineerhaju23@gmail.com"
            await db.commit()
            print(" Existing Admin email updated to real email!")
        else:
            print("Admin already exists!")