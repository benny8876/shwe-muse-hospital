# Role → allowed route groups / permissions
ROLES = [
    "super_admin",
    "hospital_admin",
    "branch_admin",
    "executive",
    "cashier",
    "receptionist",
    "doctor",
    "nurse",
    "pharmacist",
    "lab_tech",
    "radiology",
    "usg",
    "ot_staff",
    "casualty",
    "warehouse",
    "accountant",
    "hr",
]

# Permission keys used by API + UI — 4-counter clinic model
PERMS = {
    "super_admin": ["*"],
    "hospital_admin": ["*"],
    # Full day-to-day counter operations (reception, pharmacy, lab, cashier, ...)
    # for their own branch — "*" here expands to every permission string that
    # appears anywhere in this PERMS dict (see app/core/access.py's
    # ALL_PERMISSIONS/role_permissions), which crucially never includes the
    # "__admin__" sentinel (that string is never a value in this dict — it's
    # checked only via the explicit role allowlists in app/api/v1/admin.py and
    # the super_admin/hospital_admin bypass in app/core/deps.py's require()).
    # So branch_admin gets every counter action but stays locked out of
    # Owner Panel / branches / wards / capital assets / sync, and its Staff
    # Accounts access is separately scoped to its own branch in admin.py.
    "branch_admin": ["*"],
    "executive": ["analytics", "reports", "kpi"],
    "cashier": ["pos", "billing", "patients.read", "shifts", "accounts", "inventory", "inventory.read"],
    "receptionist": ["patients", "appointments", "queue", "front_desk", "billing.create", "patients.read"],
    "doctor": ["opd", "emr", "patients.read"],
    "nurse": ["ipd", "nursing", "patients.read", "vitals"],
    "pharmacist": ["pharmacy", "inventory", "inventory.read", "dispense", "wastage", "narcotics", "billing.create", "billing.read", "patients.read"],
    "lab_tech": ["lab", "billing.create", "billing.read", "patients.read"],
    "radiology": ["radiology", "billing.create", "billing.read", "patients.read"],
    "usg": ["radiology", "billing.create", "billing.read", "patients.read"],
    "ot_staff": ["ot", "billing.create"],
    "casualty": ["emergency", "billing.create"],
    "warehouse": ["inventory", "po", "transfers", "wastage"],
    "accountant": ["accounts", "reports", "billing.read"],
    "hr": ["hr", "staff", "roster", "attendance"],
}

HOME_BY_ROLE = {
    "super_admin": "/counter/cashier",
    "hospital_admin": "/counter/cashier",
    "branch_admin": "/admin/staff",
    "executive": "/counter/cashier",
    "cashier": "/counter/cashier",
    "receptionist": "/counter/reception",
    "doctor": "/counter/reception",
    "nurse": "/counter/nurse",
    "pharmacist": "/counter/pharmacy",
    "lab_tech": "/counter/lab",
    "radiology": "/counter/xray",
    "usg": "/counter/usg",
    "ot_staff": "/counter/xray",
    "casualty": "/counter/reception",
    "warehouse": "/counter/store",
    "accountant": "/counter/cashier",
    "hr": "/counter/cashier",
}


def can(role: str, perm: str) -> bool:
    allowed = PERMS.get(role, [])
    return "*" in allowed or perm in allowed or perm.split(".")[0] in allowed
