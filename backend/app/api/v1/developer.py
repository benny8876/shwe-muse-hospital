from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_developer
from app.db.session import get_db
from app.models.users import User
from app.schemas.developer import DeveloperResetPasswordIn, DeveloperUserCreateIn, DeveloperUserOut, DeveloperUserUpdateIn
from app.services.developer_service import (
    create_developer_user,
    developer_meta,
    list_developer_users,
    reset_developer_password,
    update_developer_user,
)

router = APIRouter(prefix="/developer", tags=["developer"])


@router.get("/meta")
def dev_meta(_: User = Depends(require_developer())):
    return developer_meta()


@router.get("/users", response_model=list[DeveloperUserOut])
def dev_list_users(db: Session = Depends(get_db), _: User = Depends(require_developer())):
    return list_developer_users(db)


@router.post("/users", response_model=DeveloperUserOut)
def dev_create_user(
    data: DeveloperUserCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_developer()),
):
    try:
        created = create_developer_user(
            db,
            username=data.username,
            password=data.password,
            full_name=data.full_name,
            role=data.role,
            branch_id=data.branch_id,
            phone=data.phone,
            email=data.email,
            employee_code=data.employee_code,
            allowed_counters=data.allowed_counters,
            allowed_features=data.allowed_features,
            extra_permissions=data.extra_permissions,
            actor_id=user.id,
        )
        db.commit()
        return created
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch("/users/{user_id}", response_model=DeveloperUserOut)
def dev_update_user(
    user_id: int,
    data: DeveloperUserUpdateIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_developer()),
):
    sent = data.model_dump(exclude_unset=True)
    try:
        updated = update_developer_user(
            db,
            user_id,
            full_name=data.full_name,
            role=data.role,
            branch_id=data.branch_id,
            branch_id_set="branch_id" in sent,
            phone=data.phone,
            email=data.email,
            employee_code=data.employee_code,
            is_active=data.is_active,
            allowed_counters=data.allowed_counters,
            allowed_features=data.allowed_features,
            extra_permissions=data.extra_permissions,
            actor_id=actor.id,
        )
        db.commit()
        return updated
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/users/{user_id}/reset-password", response_model=DeveloperUserOut)
def dev_reset_password(
    user_id: int,
    data: DeveloperResetPasswordIn,
    db: Session = Depends(get_db),
    actor: User = Depends(require_developer()),
):
    try:
        updated = reset_developer_password(db, user_id, data.new_password, actor.id)
        db.commit()
        return updated
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
