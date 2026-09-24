from sqlalchemy.orm import Session

from app.core.access import (
    ALL_FEATURE_KEYS,
    ALL_PERMISSIONS,
    COUNTER_DEFINITIONS,
    COUNTER_KEYS,
    COUNTER_TAB_DEFINITIONS,
    ROLE_COUNTER_DEFAULTS,
    counters_from_features,
    dump_json_list,
    parse_json_list,
    role_default_features,
    user_access_payload,
)
from app.core.rbac import PERMS, ROLES
from app.core.security import hash_password, password_ok
from app.models.users import User
from app.services.utils import audit


def developer_meta() -> dict:
    return {
        "roles": ROLES,
        "counters": COUNTER_DEFINITIONS,
        "counter_tabs": COUNTER_TAB_DEFINITIONS,
        "role_defaults": {
            role: {
                "counters": ROLE_COUNTER_DEFAULTS.get(role, []),
                "features": role_default_features(role),
                "permissions": sorted({p for p in PERMS.get(role, []) if p != "*"}),
            }
            for role in ROLES
        },
    }


def _normalize_access(
    role: str,
    counters: list[str],
    features: list[str],
    permissions: list[str],
) -> tuple[list[str], list[str], list[str]]:
    if role not in ROLES:
        raise ValueError(f"Invalid role: {role}")

    normalized_features = [f for f in features if f in ALL_FEATURE_KEYS]
    if normalized_features:
        counters = counters_from_features(normalized_features)
    else:
        counters = [c for c in counters if c in COUNTER_KEYS]

    bad_counters = [c for c in counters if c not in COUNTER_KEYS]
    if bad_counters:
        raise ValueError(f"Invalid counters: {', '.join(bad_counters)}")

    bad_perms = [p for p in permissions if p not in ALL_PERMISSIONS]
    if bad_perms:
        raise ValueError(f"Invalid permissions: {', '.join(bad_perms)}")

    return counters, normalized_features, permissions


def list_developer_users(db: Session) -> list[dict]:
    rows = db.query(User).order_by(User.role, User.full_name).all()
    out = []
    for user in rows:
        payload = user_access_payload(user)
        out.append(
            {
                "id": user.id,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role,
                "branch_id": user.branch_id,
                "phone": user.phone,
                "email": user.email,
                "employee_code": user.employee_code,
                "is_active": user.is_active,
                "last_login": user.last_login,
                **payload,
            }
        )
    return out


def create_developer_user(
    db: Session,
    *,
    username: str,
    password: str,
    full_name: str,
    role: str,
    branch_id: int | None,
    phone: str,
    email: str,
    employee_code: str,
    allowed_counters: list[str],
    allowed_features: list[str],
    extra_permissions: list[str],
    actor_id: int | None,
) -> dict:
    username = username.strip().lower()
    full_name = full_name.strip()
    if not username or not full_name:
        raise ValueError("Username and full name are required")
    counters, features, perms = _normalize_access(role, allowed_counters, allowed_features, extra_permissions)
    if not password_ok(password):
        raise ValueError("Password too weak — min 8 chars, mix of upper/lower/digit/symbol")
    if db.query(User).filter(User.username == username).first():
        raise ValueError("Username already exists")

    user = User(
        username=username,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role,
        branch_id=branch_id,
        phone=phone.strip(),
        email=email.strip(),
        employee_code=employee_code.strip(),
        is_active=True,
        allowed_counters=dump_json_list(counters),
        allowed_features=dump_json_list(features),
        extra_permissions=dump_json_list(perms),
    )
    db.add(user)
    db.flush()
    audit(db, actor_id, "developer_user_create", "user", str(user.id), f"{username} ({role})")
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "branch_id": user.branch_id,
        "phone": user.phone,
        "email": user.email,
        "employee_code": user.employee_code,
        "is_active": user.is_active,
        "last_login": user.last_login,
        **user_access_payload(user),
    }


def update_developer_user(
    db: Session,
    user_id: int,
    *,
    full_name: str | None,
    role: str | None,
    branch_id: int | None,
    branch_id_set: bool,
    phone: str | None,
    email: str | None,
    employee_code: str | None,
    is_active: bool | None,
    allowed_counters: list[str] | None,
    allowed_features: list[str] | None,
    extra_permissions: list[str] | None,
    actor_id: int | None,
) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise ValueError("User not found")
    if user.id == actor_id and is_active is False:
        raise ValueError("Cannot deactivate your own account")

    next_role = role or user.role
    next_counters = parse_json_list(user.allowed_counters) if allowed_counters is None else allowed_counters
    next_features = parse_json_list(user.allowed_features) if allowed_features is None else allowed_features
    next_perms = parse_json_list(user.extra_permissions) if extra_permissions is None else extra_permissions
    counters, features, perms = _normalize_access(next_role, next_counters, next_features, next_perms)

    if full_name is not None:
        if not full_name.strip():
            raise ValueError("Full name required")
        user.full_name = full_name.strip()
    if role is not None:
        user.role = role
    if branch_id_set:
        user.branch_id = branch_id
    if phone is not None:
        user.phone = phone.strip()
    if email is not None:
        user.email = email.strip()
    if employee_code is not None:
        user.employee_code = employee_code.strip()
    if is_active is not None:
        user.is_active = is_active
    if allowed_counters is not None or allowed_features is not None:
        user.allowed_counters = dump_json_list(counters)
        user.allowed_features = dump_json_list(features)
    if extra_permissions is not None:
        user.extra_permissions = dump_json_list(perms)

    db.flush()
    audit(db, actor_id, "developer_user_update", "user", str(user.id), user.full_name)
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "branch_id": user.branch_id,
        "phone": user.phone,
        "email": user.email,
        "employee_code": user.employee_code,
        "is_active": user.is_active,
        "last_login": user.last_login,
        **user_access_payload(user),
    }


def reset_developer_password(db: Session, user_id: int, new_password: str, actor_id: int | None) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise ValueError("User not found")
    if not password_ok(new_password):
        raise ValueError("Password too weak — min 8 chars, mix of upper/lower/digit/symbol")
    user.hashed_password = hash_password(new_password)
    audit(db, actor_id, "developer_reset_password", "user", str(user.id), user.full_name)
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role,
        "branch_id": user.branch_id,
        "phone": user.phone,
        "email": user.email,
        "employee_code": user.employee_code,
        "is_active": user.is_active,
        "last_login": user.last_login,
        **user_access_payload(user),
    }
