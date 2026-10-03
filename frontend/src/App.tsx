import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CounterLayout from './layouts/CounterLayout'
import AdminLayout from './layouts/AdminLayout'
import DevLayout from './layouts/DevLayout'
import CounterGuard from './components/CounterGuard'
import AdminStaffPage from './modules/admin/AdminStaffPage'
import AdminWardsPage from './modules/admin/AdminWardsPage'
import OwnerPanelPage from './modules/admin/OwnerPanelPage'
import DeveloperAccountsPage from './modules/developer/DeveloperAccountsPage'
import ReceptionCounterPage from './modules/counters/ReceptionCounterPage'
import AppointmentCounterPage from './modules/counters/AppointmentCounterPage'
import PatientRecordsPage from './modules/counters/PatientRecordsPage'
import PharmacyCounterPage from './modules/counters/PharmacyCounterPage'
import XrayCounterPage from './modules/counters/XrayCounterPage'
import UsgCounterPage from './modules/counters/UsgCounterPage'
import LabCounterPage from './modules/counters/LabCounterPage'
import NurseCounterPage from './modules/counters/NurseCounterPage'
import IpdBedsCounterPage from './modules/counters/IpdBedsCounterPage'
import StoreCounterPage from './modules/counters/StoreCounterPage'
import CashierCounterPage from './modules/counters/CashierCounterPage'

function Private({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  return children
}

const ADMIN_ROLES = ['super_admin', 'hospital_admin']
// branch_admin only ever reaches /admin/staff (scoped to its own branch, enforced
// server-side in app/api/v1/admin.py) — never /admin/owner, which stays owner-only.
const STAFF_ADMIN_ROLES = [...ADMIN_ROLES, 'branch_admin']

function AdminOnly({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  const hasAdminAccess = STAFF_ADMIN_ROLES.includes(session.role)
    || session.allowed_counters?.includes('admin')
    || session.allowed_features?.some((f) => f.startsWith('admin.'))
  if (!hasAdminAccess) return <Navigate to="/counter" replace />
  return children
}

function OwnerOnly({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  const hasOwnerAccess = ADMIN_ROLES.includes(session.role)
    || session.allowed_counters?.includes('admin')
    || session.allowed_features?.some((f) => f.startsWith('admin.'))
  if (!hasOwnerAccess) return <Navigate to="/admin/staff" replace />
  return children
}

// Staff Accounts is branch-local account management — it belongs on each
// branch's own offline admin (branch_admin), not the cloud-hosted Owner
// account, which won't have an easy way to create accounts against a branch's
// offline database once the two run as separate deployments (see
// docs/cloud-admin-deploy.md). super_admin/hospital_admin still have
// Developer Panel (/dev/accounts) to bootstrap the first branch_admin account
// on each branch.
function StaffAccountsOnly({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== 'branch_admin') return <Navigate to="/admin/owner" replace />
  return children
}

function AdminIndexRedirect() {
  const { session } = useAuth()
  return <Navigate to={session?.role === 'branch_admin' ? '/admin/staff' : '/admin/owner'} replace />
}

function DevOnly({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/login" replace />
  if (session.role !== 'super_admin') return <Navigate to="/counter" replace />
  return children
}

const RECEPTION_ROLES = ['receptionist', 'super_admin', 'hospital_admin', 'casualty']
const APPOINTMENT_ROLES = ['receptionist', 'super_admin', 'hospital_admin', 'casualty']
const PATIENT_RECORDS_ROLES = ['receptionist', 'pharmacist', 'nurse', 'lab_tech', 'radiology', 'usg', 'super_admin', 'hospital_admin', 'casualty']
const PHARMACY_ROLES = ['pharmacist', 'super_admin', 'hospital_admin']
const XRAY_ROLES = ['radiology', 'super_admin', 'hospital_admin', 'ot_staff']
const USG_ROLES = ['usg', 'super_admin', 'hospital_admin']
const LAB_ROLES = ['lab_tech', 'super_admin', 'hospital_admin']
const NURSE_ROLES = ['nurse', 'super_admin', 'hospital_admin']
const IPD_ROLES = ['nurse', 'super_admin', 'hospital_admin']
const STORE_ROLES = ['warehouse', 'cashier', 'pharmacist', 'super_admin', 'hospital_admin']
const CASHIER_ROLES = ['cashier', 'super_admin', 'hospital_admin', 'executive', 'accountant', 'hr']
const WARD_MANAGEMENT_ROLES = ['super_admin', 'hospital_admin']

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/counter" element={<Private><CounterLayout /></Private>}>
        <Route
          path="reception"
          element={(
            <CounterGuard counter="reception" roles={RECEPTION_ROLES}>
              <ReceptionCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="appointments"
          element={(
            <CounterGuard counter="appointments" roles={APPOINTMENT_ROLES}>
              <AppointmentCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="patient-records"
          element={(
            <CounterGuard counter="patient-records" roles={PATIENT_RECORDS_ROLES}>
              <PatientRecordsPage />
            </CounterGuard>
          )}
        />
        <Route
          path="pharmacy"
          element={(
            <CounterGuard counter="pharmacy" roles={PHARMACY_ROLES}>
              <PharmacyCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="xray"
          element={(
            <CounterGuard counter="xray" roles={XRAY_ROLES}>
              <XrayCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="usg"
          element={(
            <CounterGuard counter="usg" roles={USG_ROLES}>
              <UsgCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="lab"
          element={(
            <CounterGuard counter="lab" roles={LAB_ROLES}>
              <LabCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="nurse"
          element={(
            <CounterGuard counter="nurse" roles={NURSE_ROLES}>
              <NurseCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="ipd"
          element={(
            <CounterGuard counter="ipd" roles={IPD_ROLES}>
              <IpdBedsCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="store"
          element={(
            <CounterGuard counter="store" roles={STORE_ROLES}>
              <StoreCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="cashier"
          element={(
            <CounterGuard counter="cashier" roles={CASHIER_ROLES}>
              <CashierCounterPage />
            </CounterGuard>
          )}
        />
        <Route
          path="ward-management"
          element={(
            <CounterGuard counter="ward-management" roles={WARD_MANAGEMENT_ROLES}>
              <AdminWardsPage />
            </CounterGuard>
          )}
        />
        <Route index element={<DashboardPage />} />
      </Route>
      <Route path="/dev" element={<DevOnly><DevLayout /></DevOnly>}>
        <Route path="accounts" element={<DeveloperAccountsPage />} />
        <Route index element={<Navigate to="/dev/accounts" replace />} />
      </Route>
      <Route path="/admin" element={<AdminOnly><AdminLayout /></AdminOnly>}>
        <Route path="staff" element={<StaffAccountsOnly><AdminStaffPage /></StaffAccountsOnly>} />
        <Route path="owner" element={<OwnerOnly><OwnerPanelPage /></OwnerOnly>} />
        <Route index element={<AdminIndexRedirect />} />
      </Route>
      <Route path="/app/*" element={<Navigate to="/counter/reception" replace />} />
      <Route path="/pos/*" element={<Navigate to="/counter/cashier" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
