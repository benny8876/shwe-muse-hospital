from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.access import can_user
from app.core.rbac import can
from app.core.security import decode_token
from app.db.session import get_db
from app.models.users import User

oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    payload = decode_token(token)
    if not payload or payload.get("typ") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.get(User, int(payload["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user


def require(*perms: str):
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role in ("super_admin", "hospital_admin"):
            return user
        if not any(can_user(user, p) for p in perms):
            raise HTTPException(status_code=403, detail="Not allowed")
        return user

    return checker


def require_developer():
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role != "super_admin":
            raise HTTPException(status_code=403, detail="Developer access only")
        return user

    return checker
