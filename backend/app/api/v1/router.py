from fastapi import APIRouter

from app.api.v1 import accounting, admin, ancillary, analytics, auth, billing, counters, developer, hr, inventory, ipd, lab_templates, patients, ward_orders

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(admin.router)
api_router.include_router(developer.router)
api_router.include_router(patients.router)
api_router.include_router(billing.router)
api_router.include_router(counters.router)
api_router.include_router(inventory.router)
api_router.include_router(ipd.router)
api_router.include_router(ward_orders.router)
api_router.include_router(ancillary.router)
api_router.include_router(accounting.router)
api_router.include_router(hr.router)
api_router.include_router(analytics.router)
api_router.include_router(lab_templates.router)
