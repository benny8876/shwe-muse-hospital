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


# UHID scheme: <letter-block><3-digit slot>, e.g. A001 .. A999, then B001, ...,
# Z999, then AA001 (Excel-column-style bijective numbering) — short and easy to
# say/write on a wristband. I and O are skipped since they're easily misread
# as 1 and 0.
_UHID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"
_UHID_BLOCK_SIZE = 999


def _uhid_block_letters(block_index: int) -> str:
    n = len(_UHID_ALPHABET)
    index = block_index + 1
    letters = ""
    while index > 0:
        index, rem = divmod(index - 1, n)
        letters = _UHID_ALPHABET[rem] + letters
    return letters


def next_uhid(db: Session) -> str:
    seq = db.get(Sequence, "uhid")
    if not seq:
        seq = Sequence(name="uhid", value=0)
        db.add(seq)
    seq.value += 1
    db.flush()
    block_index, slot = divmod(seq.value - 1, _UHID_BLOCK_SIZE)
    return f"{_uhid_block_letters(block_index)}{slot + 1:03d}"


def audit(db: Session, user_id: int | None, action: str, entity: str = "", entity_id: str = "", detail: str = ""):
    db.add(AuditLog(user_id=user_id, action=action, entity=entity, entity_id=entity_id, detail=detail))
