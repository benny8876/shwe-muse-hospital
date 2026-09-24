from sqlalchemy.orm import Session

from app.core.rbac import ROLES
from app.core.security import hash_password, password_ok
from app.models.ipd import Bed, Ward
from app.models.org import Branch
from app.models.users import User
from app.services.utils import audit

WARD_CATEGORIES = ("general", "icu", "ccu", "vip", "private")


def list_staff(db: Session) -> list[User]:
    return db.query(User).order_by(User.role, User.full_name).all()


def create_branch(db: Session, *, code: str, name: str, name_mm: str, address: str, phone: str, user_id: int | None) -> Branch:
    code = code.strip().upper()
    name = name.strip()
    if not code or not name:
        raise ValueError("Branch code and name are required")
    if db.query(Branch).filter(Branch.code == code).first():
        raise ValueError(f"Branch code '{code}' already exists")
    branch = Branch(code=code, name=name, name_mm=name_mm.strip(), address=address.strip(), phone=phone.strip())
    db.add(branch)
    db.flush()
    audit(db, user_id, "branch_create", "branch", str(branch.id), name)
    return branch


def update_branch(db: Session, branch_id: int, *, name: str | None, name_mm: str | None, address: str | None, phone: str | None, user_id: int | None) -> Branch:
    branch = db.get(Branch, branch_id)
    if not branch:
        raise ValueError("Branch not found")
    if name is not None:
        name = name.strip()
        if not name:
            raise ValueError("Branch name is required")
        branch.name = name
    if name_mm is not None:
        branch.name_mm = name_mm.strip()
    if address is not None:
        branch.address = address.strip()
    if phone is not None:
        branch.phone = phone.strip()
    db.flush()
    audit(db, user_id, "branch_update", "branch", str(branch.id), branch.name)
    return branch


def create_staff(
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
    user_id: int | None,
) -> User:
    username = username.strip().lower()
    full_name = full_name.strip()
    if not username or not full_name:
        raise ValueError("Username and full name are required")
    if role not in ROLES:
        raise ValueError(f"Invalid role: {role}")
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
    )
    db.add(user)
    db.flush()
    audit(db, user_id, "staff_create", "user", str(user.id), f"{username} ({role})")
    return user


def update_staff(
    db: Session,
    staff_id: int,
    *,
    full_name: str | None,
    role: str | None,
    branch_id: int | None,
    branch_id_set: bool,
    phone: str | None,
    email: str | None,
    employee_code: str | None,
    is_active: bool | None,
    user_id: int | None,
) -> User:
    user = db.get(User, staff_id)
    if not user:
        raise ValueError("Staff not found")
    if user.role in ("super_admin", "hospital_admin") and is_active is False:
        raise ValueError("Cannot deactivate an admin account")
    if full_name is not None:
        if not full_name.strip():
            raise ValueError("Full name required")
        user.full_name = full_name.strip()
    if role is not None:
        if role not in ROLES:
            raise ValueError(f"Invalid role: {role}")
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
    audit(db, user_id, "staff_update", "user", str(user.id), user.full_name)
    return user


def reset_staff_password(db: Session, staff_id: int, new_password: str, user_id: int | None) -> User:
    user = db.get(User, staff_id)
    if not user:
        raise ValueError("Staff not found")
    if not password_ok(new_password):
        raise ValueError("Password too weak — min 8 chars, mix of upper/lower/digit/symbol")
    user.hashed_password = hash_password(new_password)
    audit(db, user_id, "staff_reset_password", "user", str(user.id), user.full_name)
    return user


def list_wards(db: Session, branch_id: int) -> list[Ward]:
    return db.query(Ward).filter(Ward.branch_id == branch_id).order_by(Ward.name).all()


def create_ward(db: Session, *, branch_id: int, name: str, category: str, floor: str, user_id: int | None) -> Ward:
    name = name.strip()
    if not name:
        raise ValueError("Ward name is required")
    if category not in WARD_CATEGORIES:
        raise ValueError(f"Invalid category: {category}")
    ward = Ward(branch_id=branch_id, name=name, category=category, floor=floor.strip())
    db.add(ward)
    db.flush()
    audit(db, user_id, "ward_create", "ward", str(ward.id), name)
    return ward


def update_ward(db: Session, ward_id: int, *, name: str | None, category: str | None, floor: str | None, user_id: int | None) -> Ward:
    ward = db.get(Ward, ward_id)
    if not ward:
        raise ValueError("Ward not found")
    if name is not None:
        if not name.strip():
            raise ValueError("Ward name is required")
        ward.name = name.strip()
    if category is not None:
        if category not in WARD_CATEGORIES:
            raise ValueError(f"Invalid category: {category}")
        ward.category = category
    if floor is not None:
        ward.floor = floor.strip()
    audit(db, user_id, "ward_update", "ward", str(ward.id), ward.name)
    return ward


def list_beds(db: Session, ward_id: int) -> list[Bed]:
    return db.query(Bed).filter(Bed.ward_id == ward_id).order_by(Bed.code).all()


def create_bed(db: Session, *, ward_id: int, code: str, daily_rate: float, hourly_rate: float, package_rate: float, user_id: int | None) -> Bed:
    code = code.strip()
    if not code:
        raise ValueError("Bed code is required")
    if not db.get(Ward, ward_id):
        raise ValueError("Ward not found")
    if db.query(Bed).filter(Bed.ward_id == ward_id, Bed.code == code).first():
        raise ValueError("Bed code already exists in this ward")
    bed = Bed(ward_id=ward_id, code=code, daily_rate=daily_rate, hourly_rate=hourly_rate, package_rate=package_rate)
    db.add(bed)
    db.flush()
    audit(db, user_id, "bed_create", "bed", str(bed.id), f"{code} (ward {ward_id})")
    return bed


def update_bed(
    db: Session,
    bed_id: int,
    *,
    code: str | None,
    daily_rate: float | None,
    hourly_rate: float | None,
    package_rate: float | None,
    user_id: int | None,
) -> Bed:
    bed = db.get(Bed, bed_id)
    if not bed:
        raise ValueError("Bed not found")
    if code is not None:
        if not code.strip():
            raise ValueError("Bed code is required")
        dup = db.query(Bed).filter(Bed.ward_id == bed.ward_id, Bed.code == code.strip(), Bed.id != bed.id).first()
        if dup:
            raise ValueError("Bed code already exists in this ward")
        bed.code = code.strip()
    if daily_rate is not None:
        bed.daily_rate = daily_rate
    if hourly_rate is not None:
        bed.hourly_rate = hourly_rate
    if package_rate is not None:
        bed.package_rate = package_rate
    audit(db, user_id, "bed_update", "bed", str(bed.id), bed.code)
    return bed
