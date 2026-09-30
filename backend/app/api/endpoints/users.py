from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.models.user import User, RoleEnum

router = APIRouter()


@router.get("/me")
def read_user_me(current_user: User = Depends(get_current_user)):
    """Used by the website to confirm a saved login is still valid and to read the user's role."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "name": current_user.name,
        "role": current_user.role,
        "company_name": current_user.company_name,
        "region": current_user.region,
        "is_verified": current_user.is_verified,
        "is_blocked": current_user.is_blocked,
    }


@router.get("/cfo/dashboard")
def get_cfo_dashboard(current_user: User = Depends(get_current_user)):
    if current_user.role != RoleEnum.cfo:
        raise HTTPException(status_code=403, detail="Not authorized. CFO role required.")
    return {"message": "Welcome to CFO Dashboard"}
