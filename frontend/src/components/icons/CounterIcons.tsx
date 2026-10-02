// Flat, two-tone "hospital" icon set (red/blue/white on a bold dark outline)
// used by the Dashboard tile grid and CounterLayout's sidebar nav — replaces
// the plain emoji icons (📋💊🧪...) which render inconsistently across
// platforms and read as informal rather than clinical.
import type { SVGProps } from 'react'

const INK = '#1e293b'
const RED = '#e0342a'
const BLUE = '#0078b4'
const BLUE_LIGHT = '#bfe3f5'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 24, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
      {children}
    </svg>
  )
}

// Reception — clipboard with a checkmark badge
export function IconReception(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="3.5" width="14" height="18" rx="2" fill="#fff" stroke={INK} strokeWidth="1.4" />
      <rect x="9" y="2" width="6" height="3.4" rx="1.2" fill={BLUE} stroke={INK} strokeWidth="1.2" />
      <path d="M7.5 12h6M7.5 15.5h6M7.5 8.5h3" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="17" cy="16" r="4" fill={RED} stroke={INK} strokeWidth="1.2" />
      <path d="M15.3 16.1l1.1 1.1 2.1-2.4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  )
}

// Patient Records — folder
export function IconPatientRecords(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3.5 6.5c0-.83.67-1.5 1.5-1.5h4l1.6 2H19c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H5c-.83 0-1.5-.67-1.5-1.5v-11z" fill={BLUE_LIGHT} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3.5 9.5h17" stroke={INK} strokeWidth="1.4" />
      <circle cx="15.5" cy="15" r="3.1" fill={RED} stroke={INK} strokeWidth="1.2" />
      <path d="M15.5 13.4v3.2M13.9 15h3.2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
    </Base>
  )
}

// Pharmacy — capsule pill
export function IconPharmacy(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="9" width="17" height="6" rx="3" fill="#fff" stroke={INK} strokeWidth="1.4" transform="rotate(-32 12 12)" />
      <path d="M9.3 7.2a3 3 0 0 1 4.24 0l3.26 3.26-4.24 4.24-3.26-3.26a3 3 0 0 1 0-4.24z" fill={RED} stroke={INK} strokeWidth="1.4" />
    </Base>
  )
}

// Stock Management — medicine jar/bottle with cross
export function IconStock(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="6" y="4" width="6.5" height="2.6" rx="0.6" fill={BLUE} stroke={INK} strokeWidth="1.2" />
      <rect x="5" y="6.6" width="8.5" height="13.4" rx="1.6" fill="#fff" stroke={INK} strokeWidth="1.4" />
      <rect x="5" y="10.5" width="8.5" height="3.2" fill={BLUE_LIGHT} stroke={INK} strokeWidth="1.1" />
      <circle cx="9.25" cy="12.1" r="1.5" fill={RED} />
      <path d="M9.25 11.2v1.8M8.35 12.1h1.8" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" />
      <path d="M16 8v10M16 8l3-2M16 12l3-1.5M16 16l3-1.5" stroke={INK} strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </Base>
  )
}

// Lab — test tube with bubbling liquid
export function IconLab(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9.5 3.5h5" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M10.2 4v10.5a3.3 3.3 0 0 0 6.6 0V4" fill="#fff" stroke={INK} strokeWidth="1.4" />
      <path d="M10.2 12.5c1 .8 2.2.8 3.3 0s2.3-.8 3.3 0v2a3.3 3.3 0 0 1-6.6 0v-2z" fill={RED} />
      <circle cx="12.2" cy="9.5" r="0.9" fill={BLUE} />
      <circle cx="14.6" cy="8" r="0.6" fill={BLUE} />
    </Base>
  )
}

// X-Ray — bone
export function IconXray(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="M6.2 8.4a2 2 0 1 1 3.1 2.5l5.7 5.7a2 2 0 1 1-2.5 3.1 2 2 0 0 1-3.4-1.5 2 2 0 0 1-1.6-3.4l-1.4-1.4a2 2 0 0 1-3.4-1.6 2 2 0 0 1 1.5-3.4z"
        fill={BLUE_LIGHT}
        stroke={INK}
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9 9.8l5.7 5.7" stroke={INK} strokeWidth="1.1" strokeDasharray="1.6 1.6" strokeLinecap="round" />
    </Base>
  )
}

// USG — probe emitting scan waves
export function IconUsg(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="14" width="6" height="6.2" rx="1.6" fill={BLUE} stroke={INK} strokeWidth="1.3" transform="rotate(-45 7 17)" />
      <path d="M11 13L14 10" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M15 9.2a3 3 0 0 0 0-4.4" stroke={RED} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M17 11a6 6 0 0 0 0-8.2" stroke={RED} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M19 13a9 9 0 0 0 0-12" stroke={RED} strokeWidth="1.3" strokeLinecap="round" />
    </Base>
  )
}

// Nurse station — stethoscope
export function IconNurse(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 4v5.2a4 4 0 0 0 8 0V4" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="4" r="1.3" fill="#fff" stroke={INK} strokeWidth="1.2" />
      <circle cx="15" cy="4" r="1.3" fill="#fff" stroke={INK} strokeWidth="1.2" />
      <path d="M15 13v2.2a4 4 0 1 0 8 0V13" stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="19" cy="12.3" r="1.3" fill={BLUE} stroke={INK} strokeWidth="1.1" />
      <circle cx="9.5" cy="16.5" r="3.6" fill={RED} stroke={INK} strokeWidth="1.3" />
      <path d="M9.5 14.9v3.2M7.9 16.5h3.2" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
    </Base>
  )
}

// Cashier — banknote
export function IconCashier(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="2.5" y="6.5" width="19" height="12" rx="1.8" fill={BLUE_LIGHT} stroke={INK} strokeWidth="1.4" />
      <circle cx="12" cy="12.5" r="3.1" fill="#fff" stroke={INK} strokeWidth="1.2" />
      <path d="M12 10.9v3.2M10.9 11.4h2.2M10.9 13.6h2.2" stroke={RED} strokeWidth="1" strokeLinecap="round" />
      <circle cx="5.2" cy="9.3" r="0.9" fill={INK} />
      <circle cx="18.8" cy="15.7" r="0.9" fill={INK} />
    </Base>
  )
}

// Dashboard "home" nav item
export function IconHome(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 11.5L12 4l8 7.5" stroke={INK} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5" fill={BLUE_LIGHT} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="10" y="14" width="4" height="6" fill={RED} stroke={INK} strokeWidth="1.1" />
    </Base>
  )
}

// Sidebar brand mark — hospital building with a cross
export function IconHospitalMark(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="9" width="16" height="12" rx="1" fill="#fff" stroke={INK} strokeWidth="1.4" />
      <rect x="9" y="3" width="6" height="6.4" fill="#fff" stroke={INK} strokeWidth="1.3" />
      <path d="M12 4.3v3.8M10.1 6.2h3.8" stroke={RED} strokeWidth="1.2" strokeLinecap="round" />
      <rect x="7" y="12" width="2.4" height="2.4" fill={BLUE} />
      <rect x="14.6" y="12" width="2.4" height="2.4" fill={BLUE} />
      <rect x="10.8" y="16" width="2.4" height="5" fill={BLUE} />
    </Base>
  )
}

// Staff Accounts — person badge
export function IconStaff(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.4" fill={BLUE_LIGHT} stroke={INK} strokeWidth="1.3" />
      <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" fill={BLUE_LIGHT} stroke={INK} strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="17.3" cy="17.3" r="3.4" fill={RED} stroke={INK} strokeWidth="1.1" />
      <path d="M15.9 17.3l.9.9 1.6-1.8" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  )
}

// Ward & Bed Management — hospital bed
export function IconWard(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 19V8.5" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M21 19v-5.5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2V19" fill={BLUE_LIGHT} stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="4.5" y="9" width="6" height="3.4" rx="0.8" fill="#fff" stroke={INK} strokeWidth="1.2" />
      <path d="M3 19h18" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.5 8.7v3.4M12.8 10.4h3.4" stroke={RED} strokeWidth="1.2" strokeLinecap="round" />
      <rect x="12" y="7.6" width="5.4" height="4.4" rx="0.8" fill="#fff" stroke={INK} strokeWidth="1.1" />
    </Base>
  )
}

// Owner Panel — bar chart with an upward trend line
export function IconOwnerPanel(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2" fill="#fff" stroke={INK} strokeWidth="1.4" />
      <rect x="6.5" y="13" width="2.6" height="5" fill={BLUE_LIGHT} stroke={INK} strokeWidth="1" />
      <rect x="10.7" y="9.5" width="2.6" height="8.5" fill={BLUE} stroke={INK} strokeWidth="1" />
      <rect x="14.9" y="6.5" width="2.6" height="11.5" fill={RED} stroke={INK} strokeWidth="1" />
      <path d="M6 9.5l3.5-2.7 3.5 1.8 4-4.4" stroke={INK} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Base>
  )
}

export const IconIpd = IconWard
export const IconStore = IconStock

// Appointments — calendar page with a clock badge
export function IconAppointment(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="4.5" width="16" height="15.5" rx="2" fill="#fff" stroke={INK} strokeWidth="1.4" />
      <path d="M4 8.5h16" stroke={INK} strokeWidth="1.4" />
      <path d="M8 3v3M16 3v3" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="6.5" y="11" width="3" height="3" fill={BLUE_LIGHT} stroke={INK} strokeWidth="0.9" />
      <circle cx="16.5" cy="15.5" r="4" fill={RED} stroke={INK} strokeWidth="1.2" />
      <path d="M16.5 13.3v2.2l1.6 1" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </Base>
  )
}

// Admin — gear
export function IconAdmin(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z"
        fill={BLUE_LIGHT}
        stroke={INK}
        strokeWidth="1.3"
      />
      <path
        d="M12 3.5l1 2.1 2.3-.4 1 2-1.6 1.7.1 2.3 2.2.9-.4 2.2-2.3.3-1.2 2-2-.9-2 .9-1.2-2-2.3-.3-.4-2.2 2.2-.9.1-2.3-1.6-1.7 1-2 2.3.4z"
        fill="none"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </Base>
  )
}
