from datetime import date, datetime

from pydantic import BaseModel


class StaffOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    department: str
    branch_id: int | None
    phone: str
    email: str
    employee_code: str
    is_active: bool
    specialty: str = ""
    last_login: datetime | None = None

    class Config:
        from_attributes = True


class StaffCreateIn(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    branch_id: int | None = None
    phone: str = ""
    email: str = ""
    employee_code: str = ""


class StaffUpdateIn(BaseModel):
    full_name: str | None = None
    role: str | None = None
    branch_id: int | None = None
    phone: str | None = None
    email: str | None = None
    employee_code: str | None = None
    is_active: bool | None = None


class ResetPasswordIn(BaseModel):
    new_password: str


class WardOut(BaseModel):
    id: int
    branch_id: int
    name: str
    category: str
    floor: str

    class Config:
        from_attributes = True


class BranchCreateIn(BaseModel):
    code: str
    name: str
    name_mm: str = ""
    address: str = ""
    phone: str = ""


class BranchUpdateIn(BaseModel):
    name: str | None = None
    name_mm: str | None = None
    address: str | None = None
    phone: str | None = None


class WardCreateIn(BaseModel):
    branch_id: int
    name: str
    category: str = "general"
    floor: str = ""


class CapitalAssetCreateIn(BaseModel):
    branch_id: int
    name: str
    category: str = ""
    cost: float
    purchased_on: date | None = None
    notes: str = ""


class CapitalAssetOut(BaseModel):
    id: int
    branch_id: int
    name: str
    category: str
    cost: float
    purchased_on: date
    notes: str

    class Config:
        from_attributes = True


class WardUpdateIn(BaseModel):
    name: str | None = None
    category: str | None = None
    floor: str | None = None


class BedOut(BaseModel):
    id: int
    ward_id: int
    code: str
    status: str
    daily_rate: float
    hourly_rate: float
    package_rate: float

    class Config:
        from_attributes = True


class BedCreateIn(BaseModel):
    ward_id: int
    code: str
    daily_rate: float = 0
    hourly_rate: float = 0
    package_rate: float = 0


class BedUpdateIn(BaseModel):
    code: str | None = None
    daily_rate: float | None = None
    hourly_rate: float | None = None
    package_rate: float | None = None
