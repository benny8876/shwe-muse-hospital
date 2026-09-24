from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.access import user_access_payload
from app.core.deps import get_current_user
from app.core.rbac import HOME_BY_ROLE
from app.core.security import create_token, decode_token, verify_password
from app.db.session import get_db
from app.models.users import User
from app.schemas.common import RefreshIn, TokenOut, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")
    return TokenOut(
        access_token=create_token(str(user.id), token_type="access"),
        refresh_token=create_token(str(user.id), token_type="refresh"),
        user_id=user.id,
        role=user.role,
        home=HOME_BY_ROLE.get(user.role, "/app"),
        full_name=user.full_name,
        branch_id=user.branch_id,
    )


@router.post("/refresh", response_model=TokenOut)
def refresh(body: RefreshIn, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("typ") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Inactive user")
    return TokenOut(
        access_token=create_token(str(user.id), token_type="access"),
        refresh_token=create_token(str(user.id), token_type="refresh"),
        user_id=user.id,
        role=user.role,
        home=HOME_BY_ROLE.get(user.role, "/app"),
        full_name=user.full_name,
        branch_id=user.branch_id,
    )


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "department": user.department,
        "branch_id": user.branch_id,
        "specialty": user.specialty,
        "consultation_fee": user.consultation_fee,
        **user_access_payload(user),
    }
