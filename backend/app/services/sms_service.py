import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.comms import OtpCode, SmsLog

logger = logging.getLogger("sms")


def send_sms(db: Session, phone: str, message: str, kind: str = "general") -> SmsLog:
    log = SmsLog(phone=phone, message=message, kind=kind, status="sent")
    db.add(log)
    if settings.sms_enabled:
        logger.info("[SMS DEMO] %s -> %s", phone, message)
    return log


def send_otp(db: Session, phone: str, purpose: str = "portal") -> str:
    code = settings.demo_otp
    db.add(
        OtpCode(
            phone=phone,
            code=code,
            purpose=purpose,
            expires_at=datetime.utcnow() + timedelta(minutes=10),
        )
    )
    send_sms(db, phone, f"Shwe Muse OTP: {code}", kind="otp")
    return code


def verify_otp(db: Session, phone: str, code: str, purpose: str = "portal") -> bool:
    row = (
        db.query(OtpCode)
        .filter(OtpCode.phone == phone, OtpCode.purpose == purpose, OtpCode.used == False, OtpCode.expires_at >= datetime.utcnow())  # noqa: E712
        .order_by(OtpCode.id.desc())
        .first()
    )
    if not row or row.code != code:
        return False
    row.used = True
    return True
