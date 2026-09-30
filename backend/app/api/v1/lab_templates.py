from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require
from app.db.session import get_db
from app.models.ancillary import LabTemplate, LabTemplateRow
from app.models.users import User
from app.schemas.actions import LabTemplateIn

router = APIRouter(prefix="/lab-templates", tags=["lab-templates"])


@router.get("")
def list_lab_templates(full: bool = False, db: Session = Depends(get_db), _: User = Depends(require("lab"))):
    q = db.query(LabTemplate)
    if full:
        q = q.options(joinedload(LabTemplate.rows))
    templates = q.order_by(LabTemplate.name).all()
    if full:
        return templates
    return [{"id": t.id, "name": t.name, "row_count": len(t.rows)} for t in templates]


@router.get("/{template_id}")
def get_lab_template(template_id: int, db: Session = Depends(get_db), _: User = Depends(require("lab"))):
    t = db.query(LabTemplate).options(joinedload(LabTemplate.rows)).filter(LabTemplate.id == template_id).first()
    if not t:
        raise HTTPException(404)
    return t


@router.post("")
def create_lab_template(data: LabTemplateIn, db: Session = Depends(get_db), user: User = Depends(require("lab"))):
    name = data.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    if not data.rows:
        raise HTTPException(400, "Add at least one row")
    if db.query(LabTemplate).filter(LabTemplate.name == name).first():
        raise HTTPException(400, "A template with this name already exists")
    t = LabTemplate(
        name=name,
        has_unit=data.has_unit,
        has_range=data.has_range,
        has_remark=data.has_remark,
        created_by=user.id,
    )
    db.add(t)
    db.flush()
    for i, r in enumerate(data.rows):
        db.add(LabTemplateRow(template_id=t.id, position=i, kind=r.kind, label=r.label, unit=r.unit, reference_range=r.reference_range, remark=r.remark))
    db.commit()
    db.refresh(t)
    return t


@router.put("/{template_id}")
def update_lab_template(template_id: int, data: LabTemplateIn, db: Session = Depends(get_db), _: User = Depends(require("lab"))):
    t = db.get(LabTemplate, template_id)
    if not t:
        raise HTTPException(404)
    name = data.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    if not data.rows:
        raise HTTPException(400, "Add at least one row")
    if name != t.name and db.query(LabTemplate).filter(LabTemplate.name == name).first():
        raise HTTPException(400, "A template with this name already exists")
    t.name = name
    t.has_unit = data.has_unit
    t.has_range = data.has_range
    t.has_remark = data.has_remark
    db.query(LabTemplateRow).filter(LabTemplateRow.template_id == t.id).delete()
    for i, r in enumerate(data.rows):
        db.add(LabTemplateRow(template_id=t.id, position=i, kind=r.kind, label=r.label, unit=r.unit, reference_range=r.reference_range, remark=r.remark))
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{template_id}")
def delete_lab_template(template_id: int, db: Session = Depends(get_db), _: User = Depends(require("lab"))):
    t = db.get(LabTemplate, template_id)
    if not t:
        raise HTTPException(404)
    db.delete(t)
    db.commit()
    return {"ok": True}
