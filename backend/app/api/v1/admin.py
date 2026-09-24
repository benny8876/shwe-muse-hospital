from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require
from app.db.session import get_db
from app.models.org import Branch
from app.models.users import User
from app.schemas.admin import (
    BedCreateIn,
    BedOut,
    BedUpdateIn,
    BranchCreateIn,
    BranchUpdateIn,
    ResetPasswordIn,
    StaffCreateIn,
    StaffOut,
    StaffUpdateIn,
    WardCreateIn,
    WardOut,
    WardUpdateIn,
)
from app.schemas.common import BranchOut
from app.services.admin_service import (
    create_bed,
    create_branch,
    create_staff,
    create_ward,
    list_beds,
    list_staff,
    list_wards,
    reset_staff_password,
    update_bed,
    update_branch,
    update_staff,
    update_ward,
)

router = APIRouter(prefix="/admin", tags=["admin"])

# No role in PERMS grants "__admin__" — only super_admin/hospital_admin (which bypass
# the permission check entirely in require()) can reach these endpoints.
ADMIN_ONLY = "__admin__"


@router.get("/staff", response_model=list[StaffOut])
def admin_list_staff(db: Session = Depends(get_db), _: User = Depends(require(ADMIN_ONLY))):
    return list_staff(db)


@router.post("/staff", response_model=StaffOut)
def admin_create_staff(
    data: StaffCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require(ADMIN_ONLY)),
):
    try:
        staff = create_staff(
            db,
            username=data.username,
            password=data.password,
            full_name=data.full_name,
            role=data.role,
            branch_id=data.branch_id,
            phone=data.phone,
            email=data.email,
            employee_code=data.employee_code,
            user_id=user.id,
        )
        db.commit()
        db.refresh(staff)
        return staff
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch("/staff/{staff_id}", response_model=StaffOut)
def admin_update_staff(
    staff_id: int,
    data: StaffUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require(ADMIN_ONLY)),
):
    sent = data.model_dump(exclude_unset=True)
    try:
        staff = update_staff(
            db,
            staff_id,
            full_name=data.full_name,
            role=data.role,
            branch_id=data.branch_id,
            branch_id_set="branch_id" in sent,
            phone=data.phone,
            email=data.email,
            employee_code=data.employee_code,
            is_active=data.is_active,
            user_id=user.id,
        )
        db.commit()
        db.refresh(staff)
        return staff
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.post("/staff/{staff_id}/reset-password", response_model=StaffOut)
def admin_reset_password(
    staff_id: int,
    data: ResetPasswordIn,
    db: Session = Depends(get_db),
    user: User = Depends(require(ADMIN_ONLY)),
):
    try:
        staff = reset_staff_password(db, staff_id, data.new_password, user.id)
        db.commit()
        db.refresh(staff)
        return staff
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/branches", response_model=list[BranchOut])
def admin_list_branches(db: Session = Depends(get_db), _: User = Depends(require(ADMIN_ONLY))):
    return db.query(Branch).order_by(Branch.id).all()


@router.post("/branches", response_model=BranchOut)
def admin_create_branch(data: BranchCreateIn, db: Session = Depends(get_db), user: User = Depends(require(ADMIN_ONLY))):
    try:
        branch = create_branch(db, code=data.code, name=data.name, name_mm=data.name_mm, address=data.address, phone=data.phone, user_id=user.id)
        db.commit()
        db.refresh(branch)
        return branch
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch("/branches/{branch_id}", response_model=BranchOut)
def admin_update_branch(branch_id: int, data: BranchUpdateIn, db: Session = Depends(get_db), user: User = Depends(require(ADMIN_ONLY))):
    try:
        branch = update_branch(db, branch_id, name=data.name, name_mm=data.name_mm, address=data.address, phone=data.phone, user_id=user.id)
        db.commit()
        db.refresh(branch)
        return branch
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/wards", response_model=list[WardOut])
def admin_list_wards(branch_id: int, db: Session = Depends(get_db), _: User = Depends(require(ADMIN_ONLY))):
    return list_wards(db, branch_id)


@router.post("/wards", response_model=WardOut)
def admin_create_ward(data: WardCreateIn, db: Session = Depends(get_db), user: User = Depends(require(ADMIN_ONLY))):
    try:
        ward = create_ward(db, branch_id=data.branch_id, name=data.name, category=data.category, floor=data.floor, user_id=user.id)
        db.commit()
        db.refresh(ward)
        return ward
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch("/wards/{ward_id}", response_model=WardOut)
def admin_update_ward(ward_id: int, data: WardUpdateIn, db: Session = Depends(get_db), user: User = Depends(require(ADMIN_ONLY))):
    try:
        ward = update_ward(db, ward_id, name=data.name, category=data.category, floor=data.floor, user_id=user.id)
        db.commit()
        db.refresh(ward)
        return ward
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.get("/wards/{ward_id}/beds", response_model=list[BedOut])
def admin_list_beds(ward_id: int, db: Session = Depends(get_db), _: User = Depends(require(ADMIN_ONLY))):
    return list_beds(db, ward_id)


@router.post("/beds", response_model=BedOut)
def admin_create_bed(data: BedCreateIn, db: Session = Depends(get_db), user: User = Depends(require(ADMIN_ONLY))):
    try:
        bed = create_bed(
            db,
            ward_id=data.ward_id,
            code=data.code,
            daily_rate=data.daily_rate,
            hourly_rate=data.hourly_rate,
            package_rate=data.package_rate,
            user_id=user.id,
        )
        db.commit()
        db.refresh(bed)
        return bed
    except ValueError as e:
        raise HTTPException(400, str(e)) from e


@router.patch("/beds/{bed_id}", response_model=BedOut)
def admin_update_bed(bed_id: int, data: BedUpdateIn, db: Session = Depends(get_db), user: User = Depends(require(ADMIN_ONLY))):
    try:
        bed = update_bed(
            db,
            bed_id,
            code=data.code,
            daily_rate=data.daily_rate,
            hourly_rate=data.hourly_rate,
            package_rate=data.package_rate,
            user_id=user.id,
        )
        db.commit()
        db.refresh(bed)
        return bed
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
