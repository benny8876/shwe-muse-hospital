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


class IpdDepositIn(BaseModel):
    amount: float
    method: str = "deposit"  # deposit | cash | kpay | wave | card


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


class LabReagentTestLinkIn(BaseModel):
    """One lab billable test that consumes this reagent, with qty per test run."""
    test_item_id: int
    qty: float = 1


class MedicineIn(BaseModel):
    name: str
    sku: str = ""
    barcode: str = ""
    price: float = 0
    cost: float = 0
    min_stock: float = 10
    # pharmacy | lab | xray | usg — stock segments on the Store counter
    department: str = "pharmacy"
    lab_tests: list[LabReagentTestLinkIn] = []


class MedicineUpdateIn(BaseModel):
    name: str | None = None
    price: float | None = None
    cost: float | None = None
    min_stock: float | None = None
    lab_tests: list[LabReagentTestLinkIn] | None = None


class WardMedOrderItemIn(BaseModel):
    item_id: int
    qty: float


class WardMedOrderIn(BaseModel):
    patient_id: int
    branch_id: int
    admission_id: int | None = None
    invoice_id: int | None = None
    note: str = ""
    items: list[WardMedOrderItemIn] = []


class AppointmentIn(BaseModel):
    patient_id: int
    doctor_id: int
    branch_id: int
    scheduled_at: datetime
    duration_minutes: int = 15
    source: str = "counter"  # counter | phone | portal
    notes: str = ""


class AppointmentUpdateIn(BaseModel):
    scheduled_at: datetime | None = None
    doctor_id: int | None = None
    duration_minutes: int | None = None
    status: str | None = None  # booked | arrived | done | cancelled
    notes: str | None = None


class StockReceiveIn(BaseModel):
    item_id: int
    warehouse_id: int
    qty: float
    unit_cost: float
    batch_no: str = ""
    expiry_date: date | None = None
    selling_price: float | None = None
    min_stock: float | None = None


class LabTemplateRowIn(BaseModel):
    kind: str = "row"  # section | row
    label: str
    unit: str = ""
    reference_range: str = ""
    remark: str = ""


class LabTemplateIn(BaseModel):
    name: str
    has_unit: bool = True
    has_range: bool = True
    has_remark: bool = True
    rows: list[LabTemplateRowIn] = []
