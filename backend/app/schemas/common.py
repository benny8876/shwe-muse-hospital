from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user_id: int
    role: str
    home: str
    full_name: str
    branch_id: int | None = None


class RefreshIn(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    department: str
    branch_id: int | None
    specialty: str = ""
    consultation_fee: float = 0

    class Config:
        from_attributes = True


class BranchOut(BaseModel):
    id: int
    code: str
    name: str
    name_mm: str
    is_main: bool

    class Config:
        from_attributes = True


class PatientIn(BaseModel):
    name: str
    name_mm: str = ""
    father_name: str = ""
    phone: str = ""
    gender: str = ""
    dob: str | None = None
    age_years: int | None = None
    age_months: int | None = None
    age_days: int | None = None
    nrc: str = ""
    address: str = ""
    referring_doctor: str = ""
    blood_group: str = ""
    allergies: str = ""
    corporate_account_id: int | None = None
    insurance_name: str = ""
    insurance_no: str = ""


class PatientOut(BaseModel):
    id: int
    uhid: str
    name: str
    name_mm: str = ""
    father_name: str = ""
    phone: str = ""
    gender: str = ""
    dob: date | None = None
    age_years: int | None = None
    age_months: int | None = None
    age_days: int | None = None
    nrc: str = ""
    address: str = ""
    referring_doctor: str = ""
    blood_group: str = ""
    allergies: str = ""
    corporate_account_id: int | None = None
    insurance_name: str = ""
    insurance_no: str = ""
    created_at: datetime

    class Config:
        from_attributes = True


class CatalogOut(BaseModel):
    id: int
    sku: str
    barcode: str
    name: str
    name_mm: str
    category: str
    price: float
    is_stock: bool
    min_stock: float

    class Config:
        from_attributes = True


class InvoiceLineIn(BaseModel):
    item_id: int | None = None
    qty: float = 1
    unit_price: float | None = None
    source: str = "opd"
    description: str = ""
    discount: float = 0


class InvoiceLineUpdateIn(BaseModel):
    unit_price: float | None = None
    qty: float | None = None


class PaymentIn(BaseModel):
    method: str
    amount: float


class MultiPaymentIn(BaseModel):
    payments: list[PaymentIn]


class InvoiceLineOut(BaseModel):
    id: int
    description: str = ""
    qty: float = 1
    unit_price: float = 0
    discount: float = 0
    amount: float = 0
    source: str = "opd"

    class Config:
        from_attributes = True


class PaymentOut(BaseModel):
    id: int
    method: str
    amount: float
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class InvoiceOut(BaseModel):
    id: int
    number: str
    patient_id: int | None
    status: str
    subtotal: float
    discount: float
    total: float
    paid: float
    balance: float
    kind: str
    admission_id: int | None = None
    created_at: datetime | None = None
    lines: list[InvoiceLineOut] = []
    payments: list[PaymentOut] = []

    class Config:
        from_attributes = True


class VisitIn(BaseModel):
    patient_id: int
    branch_id: int
    doctor_id: int | None = None
    diagnosis: str = ""
    prescription: str = ""


class LabOrderIn(BaseModel):
    patient_id: int
    branch_id: int
    tests: str
    doctor_id: int | None = None


class ServiceOrderIn(BaseModel):
    patient_id: int
    branch_id: int
    service_type: str
    sku: str | None = None


class QueueIn(BaseModel):
    branch_id: int
    department: str = "OPD"
    patient_id: int | None = None


class InvoiceCreateIn(BaseModel):
    patient_id: int | None = None
    branch_id: int
    kind: str = "opd"
    doctor_id: int | None = None
