export function formatMoney(n: number | null | undefined, currency = 'MMK') {
  if (n == null || Number.isNaN(n)) return '—'
  return `${Number(n).toLocaleString()} ${currency}`
}

export function formatAge(years?: number | null, months?: number | null, days?: number | null) {
  const y = years ?? 0
  const m = months ?? 0
  const d = days ?? 0
  if (years == null && (months == null || months === 0) && (days == null || days === 0)) return '—'
  const parts: string[] = []
  if (y > 0) parts.push(`${y}y`)
  if (m > 0) parts.push(`${m}m`)
  if (d > 0) parts.push(`${d}d`)
  return parts.length ? parts.join(' ') : '0y'
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

export function labelize(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function pick(row: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part]
    return undefined
  }, row)
}
