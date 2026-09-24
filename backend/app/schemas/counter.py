from pydantic import BaseModel


class ReceptionRegisterIn(BaseModel):
    branch_id: int
    doctor_id: int
    patient_id: int | None = None
    name: str = ""
    phone: str = ""
    gender: str = "F"
    age_years: int | None = None
    address: str = ""
    father_name: str = ""
    referring_doctor: str = ""
    patient_type: str = "opd"
    bed_id: int | None = None
    deposit: float = 0
    billing_mode: str = "daily"


class ConvertTypeIn(BaseModel):
    branch_id: int
    patient_id: int
    target_type: str  # opd | ipd
    doctor_id: int | None = None
    bed_id: int | None = None
    deposit: float = 0
    billing_mode: str = "daily"


class RxItemIn(BaseModel):
    catalog_item_id: int | None = None
    free_text_name: str = ""
    qty: float = 1
    dosage_instructions: str = ""


class DoctorExamIn(BaseModel):
    branch_id: int
    patient_id: int
    doctor_id: int
    chief_complaint: str = ""
    diagnosis: str = ""
    notes: str = ""
    follow_up_at: str | None = None
    rx_items: list[RxItemIn] = []


class ServiceItemIn(BaseModel):
    department: str  # "lab" | "xray" | "usg"
    name: str
    price: float = 0


class ServiceItemUpdateIn(BaseModel):
    name: str | None = None
    price: float | None = None
    is_active: bool | None = None


class LabOrderCounterIn(BaseModel):
    branch_id: int
    patient_id: int
    item_id: int


class LabResultIn(BaseModel):
    order_id: int
    result: str


class UsgOrderIn(BaseModel):
    branch_id: int
    patient_id: int
    item_id: int


class RadiologyResultIn(BaseModel):
    order_id: int
    findings: str


class PharmacyCounterIn(BaseModel):
    branch_id: int
    patient_id: int
    item_id: int
    warehouse_id: int
    qty: float = 1
    prescription_item_id: int | None = None


class XrayCounterIn(BaseModel):
    branch_id: int
    patient_id: int
    item_id: int


class StockCountIn(BaseModel):
    item_id: int
    warehouse_id: int
    counted_qty: float
    notes: str = ""


class DoctorIn(BaseModel):
    full_name: str
    consultation_fee: float = 0
    specialty: str = "General Medicine"


class DoctorUpdateIn(BaseModel):
    full_name: str | None = None
    consultation_fee: float | None = None
    specialty: str | None = None
