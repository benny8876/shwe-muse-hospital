import type { ComponentType, SVGProps } from 'react'
import {
  IconAppointment,
  IconCashier,
  IconIpd,
  IconLab,
  IconNurse,
  IconPatientRecords,
  IconPharmacy,
  IconReception,
  IconStore,
  IconUsg,
  IconWard,
  IconXray,
} from '../components/icons/CounterIcons'

type CounterIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

export type CounterLink = {
  key: string
  to: string
  label: string
  icon: CounterIcon
  roles: string[]
  subtitle: string
}

export const COUNTER_LINKS: CounterLink[] = [
  { key: 'reception', to: '/counter/reception', label: 'counterReception', icon: IconReception, roles: ['receptionist', 'super_admin', 'hospital_admin', 'casualty'], subtitle: 'Register OPD or admit IPD patient' },
  { key: 'appointments', to: '/counter/appointments', label: 'counterAppointments', icon: IconAppointment, roles: ['receptionist', 'super_admin', 'hospital_admin', 'casualty'], subtitle: 'Book and manage doctor appointments' },
  { key: 'patient-records', to: '/counter/patient-records', label: 'counterPatientRecords', icon: IconPatientRecords, roles: ['receptionist', 'pharmacist', 'nurse', 'lab_tech', 'radiology', 'usg', 'super_admin', 'hospital_admin', 'casualty'], subtitle: 'Search patient visit & treatment history' },
  { key: 'pharmacy', to: '/counter/pharmacy', label: 'counterPharmacy', icon: IconPharmacy, roles: ['pharmacist', 'super_admin', 'hospital_admin'], subtitle: 'Dispense medicine & ward orders' },
  { key: 'lab', to: '/counter/lab', label: 'counterLab', icon: IconLab, roles: ['lab_tech', 'super_admin', 'hospital_admin'], subtitle: 'Order test, enter result, print report' },
  { key: 'xray', to: '/counter/xray', label: 'counterXray', icon: IconXray, roles: ['radiology', 'super_admin', 'hospital_admin', 'ot_staff'], subtitle: 'Select patient, order X-ray, enter findings' },
  { key: 'usg', to: '/counter/usg', label: 'counterUsg', icon: IconUsg, roles: ['usg', 'super_admin', 'hospital_admin'], subtitle: 'Order scan, enter findings, print report' },
  { key: 'nurse', to: '/counter/nurse', label: 'counterNurse', icon: IconNurse, roles: ['nurse', 'super_admin', 'hospital_admin'], subtitle: 'OPD/IPD medicine orders & IPD nursing notes' },
  { key: 'ipd', to: '/counter/ipd', label: 'counterIpd', icon: IconIpd, roles: ['nurse', 'super_admin', 'hospital_admin'], subtitle: 'Ward/bed grid — see who is in each bed and running bill' },
  { key: 'store', to: '/counter/store', label: 'counterStore', icon: IconStore, roles: ['warehouse', 'cashier', 'pharmacist', 'super_admin', 'hospital_admin'], subtitle: 'Stock by department — Pharmacy, Lab, X-ray, USG' },
  { key: 'cashier', to: '/counter/cashier', label: 'counterCashier', icon: IconCashier, roles: ['cashier', 'super_admin', 'hospital_admin', 'executive', 'accountant', 'hr'], subtitle: 'Collect payment & expenses' },
  { key: 'ward-management', to: '/counter/ward-management', label: 'counterWardManagement', icon: IconWard, roles: ['super_admin', 'hospital_admin'], subtitle: 'Create wards, set bed rates (daily/hourly/package)' },
]

export function visibleCounters(role: string, allowedCounters?: string[] | null) {
  if (allowedCounters && allowedCounters.length > 0) {
    const set = new Set(allowedCounters)
    return COUNTER_LINKS.filter((l) => set.has(l.key))
  }
  return COUNTER_LINKS.filter((l) => l.roles.includes(role))
}
