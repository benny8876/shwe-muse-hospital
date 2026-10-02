import json
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require
from app.db.session import get_db
from app.models.accounting import SyncSnapshot
from app.models.users import User
from app.schemas.sync import SyncPushIn

router = APIRouter(prefix="/sync", tags=["sync"])


def _verify_sync_key(x_sync_key: str = Header(default="")) -> None:
    # A branch's cron job (scripts/push_sync.py) has no logged-in user to
    # authenticate as, so this endpoint uses a shared secret header instead of
    # the normal JWT login flow every other endpoint in this app uses.
    if x_sync_key != settings.sync_shared_key:
        raise HTTPException(401, "Invalid sync key")


@router.post("/push")
def push_snapshot(data: SyncPushIn, db: Session = Depends(get_db), _: None = Depends(_verify_sync_key)):
    payload = json.dumps({
        "analytics": data.analytics,
        "stock_snapshot": data.stock_snapshot,
        "capital_assets": data.capital_assets,
    })
    snap = SyncSnapshot(
        branch_code=data.branch_code,
        period_label=data.period_label,
        date_from=datetime.fromisoformat(data.date_from) if data.date_from else None,
        date_to=datetime.fromisoformat(data.date_to) if data.date_to else None,
        payload=payload,
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return {"ok": True, "id": snap.id}


@router.get("/latest")
def latest_snapshots(db: Session = Depends(get_db), _: User = Depends(require("__admin__"))):
    """Latest snapshot per branch_code — the cloud Admin Panel's Owner Panel
    reads this (logged-in browser session, hence the normal admin-only
    permission check here, unlike /push's shared-key auth) instead of
    querying live Invoice/Payment tables, which don't exist on a cloud
    instance that only ever receives summarized rollups."""
    rows = db.query(SyncSnapshot).order_by(SyncSnapshot.received_at.desc()).all()
    latest: dict[str, SyncSnapshot] = {}
    for r in rows:
        latest.setdefault(r.branch_code, r)
    return [
        {
            "branch_code": r.branch_code,
            "period_label": r.period_label,
            "date_from": r.date_from.isoformat() if r.date_from else None,
            "date_to": r.date_to.isoformat() if r.date_to else None,
            "received_at": r.received_at.isoformat(),
            **json.loads(r.payload),
        }
        for r in latest.values()
    ]
