from datetime import date, datetime

from pydantic import BaseModel


class AdmitIn(BaseModel):
    patient_id: int
    branch_id: int
    bed_id: int
    doctor_id: int | None = None
    deposit: float = 0
    billing_mode: str = "daily"


class VitalsIn(BaseModel):
    bp: str = ""
    pulse: str = ""
    temp: str = ""
    spo2: str = ""
    weight: str = ""


class NoteIn(BaseModel):
    note: str


class DischargeIn(BaseModel):
    summary: str = ""


class TransferIn(BaseModel):
    bed_id: int


class RadiologyOrderIn(BaseModel):
    patient_id: int
    branch_id: int
    modality: str = "xray"
    doctor_id: int | None = None


class OTScheduleIn(BaseModel):
    patient_id: int
    branch_id: int
    scheduled_at: datetime
    procedure: str
    surgeon_id: int | None = None


class ExpenseIn(BaseModel):
    branch_id: int
    category: str
    name: str = ""
    amount: float
    paid_from: str = "petty"
    paid_by: str = ""
    notes: str = ""


class DispenseIn(BaseModel):
    item_id: int
    warehouse_id: int
    qty: float
    patient_id: int | None = None
    ref: str = ""


class WastageIn(BaseModel):
    batch_id: int
    qty: float
    reason: str


class MedicineIn(BaseModel):
    name: str
    sku: str = ""
    barcode: str = ""
    price: float = 0
    cost: float = 0
    min_stock: float = 10


class MedicineUpdateIn(BaseModel):
    name: str | None = None
    price: float | None = None
    cost: float | None = None
    min_stock: float | None = None


class WardMedOrderItemIn(BaseModel):
    item_id: int
    qty: float


class WardMedOrderIn(BaseModel):
    patient_id: int
    branch_id: int
    admission_id: int | None = None
    note: str = ""
    items: list[WardMedOrderItemIn] = []


class StockReceiveIn(BaseModel):
    item_id: int
    warehouse_id: int
    qty: float
    unit_cost: float
    batch_no: str = ""
    expiry_date: date | None = None
    selling_price: float | None = None
    min_stock: float | None = None
