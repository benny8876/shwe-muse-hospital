from datetime import datetime

from pydantic import BaseModel


class DeveloperUserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    branch_id: int | None
    phone: str
    email: str
    employee_code: str
    is_active: bool
    allowed_counters: list[str] = []
    allowed_features: list[str] = []
    extra_permissions: list[str] = []
    effective_permissions: list[str] = []
    last_login: datetime | None = None

    class Config:
        from_attributes = True


class DeveloperUserCreateIn(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    branch_id: int | None = None
    phone: str = ""
    email: str = ""
    employee_code: str = ""
    allowed_counters: list[str] = []
    allowed_features: list[str] = []
    extra_permissions: list[str] = []


class DeveloperUserUpdateIn(BaseModel):
    full_name: str | None = None
    role: str | None = None
    branch_id: int | None = None
    phone: str | None = None
    email: str | None = None
    employee_code: str | None = None
    is_active: bool | None = None
    allowed_counters: list[str] | None = None
    allowed_features: list[str] | None = None
    extra_permissions: list[str] | None = None


class DeveloperResetPasswordIn(BaseModel):
    new_password: str
