from sqlalchemy.orm import Session

from app.models.org import AuditLog, Sequence


def next_number(db: Session, name: str, prefix: str) -> str:
    seq = db.get(Sequence, name)
    if not seq:
        seq = Sequence(name=name, value=0)
        db.add(seq)
    seq.value += 1
    db.flush()
    return f"{prefix}{seq.value:06d}"


def audit(db: Session, user_id: int | None, action: str, entity: str = "", entity_id: str = "", detail: str = ""):
    db.add(AuditLog(user_id=user_id, action=action, entity=entity, entity_id=entity_id, detail=detail))
