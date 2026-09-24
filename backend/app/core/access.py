import json

from app.core.rbac import PERMS, ROLES
from app.models.users import User

COUNTER_DEFINITIONS = [
    {"key": "reception", "label": "Reception", "subtitle": "Register OPD or admit IPD patient"},
    {"key": "patient-records", "label": "Patient Records", "subtitle": "Search patient visit & treatment history"},
    {"key": "pharmacy", "label": "Pharmacy", "subtitle": "Dispense medicine & ward orders"},
    {"key": "lab", "label": "Laboratory", "subtitle": "Order tests and enter results"},
    {"key": "xray", "label": "X-Ray", "subtitle": "Order X-ray and enter findings"},
    {"key": "usg", "label": "USG", "subtitle": "Order ultrasound and enter findings"},
    {"key": "nurse", "label": "Nurse Station", "subtitle": "IPD vitals and nursing notes"},
    {"key": "ipd", "label": "IPD Beds", "subtitle": "Ward/bed grid — admitted patients at a glance"},
    {"key": "store", "label": "Stock Management", "subtitle": "Stock in/out, warehouse, suppliers — shared across counters"},
    {"key": "cashier", "label": "Cashier", "subtitle": "Collect payments and expenses"},
    {"key": "admin", "label": "Admin Panel", "subtitle": "Staff, ward/bed setup, owner reports"},
]

COUNTER_TAB_DEFINITIONS: dict[str, list[dict[str, str]]] = {
    "reception": [
        {"key": "register", "label": "Register"},
        {"key": "convert", "label": "Convert OPD ⇄ IPD"},
        {"key": "history", "label": "Bill History"},
    ],
    "patient-records": [
        {"key": "main", "label": "Patient Records"},
    ],
    "pharmacy": [
        {"key": "sale", "label": "Sale"},
        {"key": "wardOrders", "label": "Ward Orders"},
        {"key": "history", "label": "Order History"},
    ],
    "lab": [
        {"key": "order", "label": "Order Test"},
        {"key": "results", "label": "Results"},
    ],
    "xray": [
        {"key": "order", "label": "Order X-Ray"},
        {"key": "results", "label": "Findings"},
    ],
    "usg": [
        {"key": "order", "label": "Order Scan"},
        {"key": "results", "label": "Findings"},
    ],
    "nurse": [
        {"key": "patients", "label": "Admitted Patients"},
        {"key": "orders", "label": "Ward Medicine Orders"},
    ],
    "ipd": [
        {"key": "beds", "label": "Bed Grid"},
    ],
    "store": [
        {"key": "stock", "label": "Stock"},
        {"key": "receive", "label": "Stock In"},
        {"key": "suppliers", "label": "Suppliers"},
        {"key": "wastage", "label": "Stock Out"},
    ],
    "cashier": [
        {"key": "bills", "label": "Open Bills"},
        {"key": "expenses", "label": "Expenses"},
        {"key": "doctors", "label": "Doctors"},
        {"key": "services", "label": "Test/Service Catalog"},
        {"key": "analytics", "label": "Analyze"},
        {"key": "history", "label": "History"},
    ],
    "admin": [
        {"key": "staff", "label": "Staff Accounts"},
        {"key": "wards", "label": "Ward & Bed Management"},
        {"key": "owner", "label": "Owner Panel"},
    ],
}

COUNTER_KEYS = {c["key"] for c in COUNTER_DEFINITIONS}

ALL_FEATURE_KEYS = sorted(
    {
        f"{counter}.{tab['key']}"
        for counter, tabs in COUNTER_TAB_DEFINITIONS.items()
        for tab in tabs
    }
)

ROLE_COUNTER_DEFAULTS: dict[str, list[str]] = {
    "super_admin": list(COUNTER_KEYS),
    "hospital_admin": list(COUNTER_KEYS),
    "executive": ["cashier", "patient-records"],
    "cashier": ["cashier", "patient-records", "store"],
    "receptionist": ["reception", "patient-records"],
    "doctor": ["reception", "patient-records"],
    "nurse": ["nurse", "ipd", "patient-records"],
    "pharmacist": ["pharmacy", "patient-records", "store"],
    "lab_tech": ["lab", "patient-records"],
    "radiology": ["xray", "patient-records"],
    "usg": ["usg", "patient-records"],
    "ot_staff": ["xray", "patient-records"],
    "casualty": ["reception", "patient-records"],
    "warehouse": ["store"],
    "accountant": ["cashier", "patient-records"],
    "hr": ["cashier"],
}

ALL_PERMISSIONS = sorted({p for perms in PERMS.values() for p in perms if p != "*"})


def parse_json_list(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return []
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return [str(x) for x in data if str(x)]
    except json.JSONDecodeError:
        return [part.strip() for part in raw.split(",") if part.strip()]
    return []


def dump_json_list(values: list[str] | None) -> str:
    cleaned = [v for v in (values or []) if v]
    return json.dumps(cleaned) if cleaned else ""


def features_for_counter(counter: str) -> list[str]:
    return [f"{counter}.{tab['key']}" for tab in COUNTER_TAB_DEFINITIONS.get(counter, [])]


def counters_from_features(features: list[str]) -> list[str]:
    keys = sorted({f.split(".", 1)[0] for f in features if "." in f and f.split(".", 1)[0] in COUNTER_KEYS})
    return keys


def role_default_features(role: str) -> list[str]:
    feats: list[str] = []
    for counter in ROLE_COUNTER_DEFAULTS.get(role, []):
        feats.extend(features_for_counter(counter))
    return sorted(set(feats))


def role_permissions(role: str) -> list[str]:
    perms = PERMS.get(role, [])
    if "*" in perms:
        return list(ALL_PERMISSIONS)
    return list(perms)


def effective_permissions(user: User) -> list[str]:
    base = set(role_permissions(user.role))
    base.update(parse_json_list(user.extra_permissions))
    return sorted(base)


def can_user(user: User, perm: str) -> bool:
    if user.role in ("super_admin", "hospital_admin"):
        return True
    allowed = effective_permissions(user)
    return perm in allowed or perm.split(".")[0] in allowed


def effective_counters(user: User) -> list[str]:
    custom = parse_json_list(user.allowed_counters)
    if custom:
        return [c for c in custom if c in COUNTER_KEYS]
    return [c for c in ROLE_COUNTER_DEFAULTS.get(user.role, []) if c in COUNTER_KEYS]


def effective_features(user: User) -> list[str]:
    custom = parse_json_list(user.allowed_features)
    if custom:
        return [f for f in custom if f in ALL_FEATURE_KEYS]
    feats: list[str] = []
    for counter in effective_counters(user):
        feats.extend(features_for_counter(counter))
    return sorted(set(feats))


def can_feature(user: User, counter: str, tab: str) -> bool:
    if user.role in ("super_admin", "hospital_admin"):
        return True
    return f"{counter}.{tab}" in effective_features(user)


def user_access_payload(user: User) -> dict:
    return {
        "allowed_counters": effective_counters(user),
        "allowed_features": effective_features(user),
        "extra_permissions": parse_json_list(user.extra_permissions),
        "effective_permissions": effective_permissions(user),
    }
