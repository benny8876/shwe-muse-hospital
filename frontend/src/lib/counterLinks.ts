import type { ComponentType, SVGProps } from 'react'
import {
  IconCashier,
  IconIpd,
  IconLab,
  IconNurse,
  IconPatientRecords,
  IconPharmacy,
  IconReception,
  IconStore,
  IconUsg,
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
  { key: 'patient-records', to: '/counter/patient-records', label: 'counterPatientRecords', icon: IconPatientRecords, roles: ['receptionist', 'pharmacist', 'nurse', 'lab_tech', 'radiology', 'usg', 'super_admin', 'hospital_admin', 'casualty'], subtitle: 'Search patient visit & treatment history' },
  { key: 'pharmacy', to: '/counter/pharmacy', label: 'counterPharmacy', icon: IconPharmacy, roles: ['pharmacist', 'super_admin', 'hospital_admin'], subtitle: 'Dispense medicine & ward orders' },
  { key: 'lab', to: '/counter/lab', label: 'counterLab', icon: IconLab, roles: ['lab_tech', 'super_admin', 'hospital_admin'], subtitle: 'Order test, enter result, print report' },
  { key: 'xray', to: '/counter/xray', label: 'counterXray', icon: IconXray, roles: ['radiology', 'super_admin', 'hospital_admin', 'ot_staff'], subtitle: 'Select patient, order X-ray, enter findings' },
  { key: 'usg', to: '/counter/usg', label: 'counterUsg', icon: IconUsg, roles: ['usg', 'super_admin', 'hospital_admin'], subtitle: 'Order scan, enter findings, print report' },
  { key: 'nurse', to: '/counter/nurse', label: 'counterNurse', icon: IconNurse, roles: ['nurse', 'super_admin', 'hospital_admin'], subtitle: 'Admitted IPD patients — vitals & nursing notes' },
  { key: 'ipd', to: '/counter/ipd', label: 'counterIpd', icon: IconIpd, roles: ['nurse', 'super_admin', 'hospital_admin'], subtitle: 'Ward/bed grid — see who is in each bed and running bill' },
  { key: 'store', to: '/counter/store', label: 'counterStore', icon: IconStore, roles: ['warehouse', 'cashier', 'pharmacist', 'super_admin', 'hospital_admin'], subtitle: 'Stock in/out, warehouse, suppliers — shared across counters' },
  { key: 'cashier', to: '/counter/cashier', label: 'counterCashier', icon: IconCashier, roles: ['cashier', 'super_admin', 'hospital_admin', 'executive', 'accountant', 'hr'], subtitle: 'Collect payment & expenses' },
]

export function visibleCounters(role: string, allowedCounters?: string[] | null) {
  if (allowedCounters && allowedCounters.length > 0) {
    const set = new Set(allowedCounters)
    return COUNTER_LINKS.filter((l) => set.has(l.key))
  }
  return COUNTER_LINKS.filter((l) => l.roles.includes(role))
}
