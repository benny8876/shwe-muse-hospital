from typing import Any

from pydantic import BaseModel


class SyncPushIn(BaseModel):
    branch_code: str
    period_label: str = ""
    date_from: str | None = None
    date_to: str | None = None
    analytics: dict[str, Any]
    stock_snapshot: list[dict[str, Any]] = []
    capital_assets: list[dict[str, Any]] = []
