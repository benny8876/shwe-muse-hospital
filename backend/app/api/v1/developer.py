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


# Each offline branch server is meant to carry its own local developer/bootstrap
# account (e.g. "dev1" on Branch 1's server, "dev2" on Branch 2's) rather than a
# single global one — in the real deployment the two branch servers aren't even
# networked together, so a dev account physically can't reach the other branch's
# data. We mirror that here by scoping the Developer Panel to the acting user's
# own branch_id whenever it's set; a super_admin with branch_id=None (no such
# account exists by default, but the escape hatch is intentional) stays unscoped.
def _actor_scope_branch_id(actor: User) -> int | None:
    return actor.branch_id


@router.get("/meta")
def dev_meta(_: User = Depends(require_developer())):
    return developer_meta()


@router.get("/users", response_model=list[DeveloperUserOut])
def dev_list_users(db: Session = Depends(get_db), actor: User = Depends(require_developer())):
    return list_developer_users(db, branch_id=_actor_scope_branch_id(actor))


@router.post("/users", response_model=DeveloperUserOut)
def dev_create_user(
    data: DeveloperUserCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_developer()),
):
    scope_branch_id = _actor_scope_branch_id(user)
    branch_id = data.branch_id
    if scope_branch_id is not None:
        branch_id = scope_branch_id  # force own branch — ignore any branch_id sent by the client
    try:
        created = create_developer_user(
            db,
            username=data.username,
            password=data.password,
            full_name=data.full_name,
            role=data.role,
            branch_id=branch_id,
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
    scope_branch_id = _actor_scope_branch_id(actor)
    sent = data.model_dump(exclude_unset=True)
    if scope_branch_id is not None:
        target = db.get(User, user_id)
        if not target or target.branch_id != scope_branch_id:
            raise HTTPException(403, "Not allowed")
        if "branch_id" in sent and data.branch_id != scope_branch_id:
            raise HTTPException(403, "Cannot move this account to another branch")
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
    scope_branch_id = _actor_scope_branch_id(actor)
    if scope_branch_id is not None:
        target = db.get(User, user_id)
        if not target or target.branch_id != scope_branch_id:
            raise HTTPException(403, "Not allowed")
    try:
        updated = reset_developer_password(db, user_id, data.new_password, actor.id)
        db.commit()
        return updated
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
