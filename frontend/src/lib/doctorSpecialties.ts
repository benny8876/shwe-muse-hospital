/** Clinic / department labels for attending doctors (Reception + Cashier). */
export const DOCTOR_SPECIALTY_PRESETS = [
  'General Medicine',
  'OG (Obstetrics & Gynecology)',
  'Pediatrics',
  'Surgery',
  'Orthopedic',
  'ENT',
  'Eye (Ophthalmology)',
  'Dental',
  'Physician',
  'Other',
] as const

export type DoctorLike = { specialty?: string | null }

export function normalizeSpecialty(s: string | null | undefined): string {
  const t = (s || '').trim()
  return t || 'General Medicine'
}

/** Specialty options for filters: presets + any values already on doctors in DB. */
export function specialtyOptionsForDoctors(doctors: DoctorLike[]): string[] {
  const set = new Set<string>(DOCTOR_SPECIALTY_PRESETS)
  for (const d of doctors) {
    const sp = normalizeSpecialty(d.specialty)
    set.add(sp)
  }
  return [...set].sort((a, b) => {
    const ai = DOCTOR_SPECIALTY_PRESETS.indexOf(a as typeof DOCTOR_SPECIALTY_PRESETS[number])
    const bi = DOCTOR_SPECIALTY_PRESETS.indexOf(b as typeof DOCTOR_SPECIALTY_PRESETS[number])
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return a.localeCompare(b)
  })
}

export function doctorsInSpecialty<T extends DoctorLike>(doctors: T[], specialty: string): T[] {
  const want = normalizeSpecialty(specialty)
  return doctors.filter((d) => normalizeSpecialty(d.specialty) === want)
}

export function doctorOptionLabel(d: { full_name: string; specialty?: string | null; consultation_fee?: number }): string {
  const sp = normalizeSpecialty(d.specialty)
  const fee = d.consultation_fee != null && d.consultation_fee > 0 ? ` · ${Math.round(d.consultation_fee).toLocaleString()} MMK` : ''
  return `${d.full_name} (${sp})${fee}`
}
