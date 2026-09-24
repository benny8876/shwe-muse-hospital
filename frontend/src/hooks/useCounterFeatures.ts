import { useAuth } from '../lib/auth'

/** Returns allowed tab ids for a counter, or null if all tabs are allowed. */
export function useCounterFeatures(counter: string): string[] | null {
  const { session } = useAuth()
  const feats = session?.allowed_features
  if (!feats || feats.length === 0) return null
  const tabs = feats.filter((f) => f.startsWith(`${counter}.`)).map((f) => f.split('.')[1])
  return tabs.length > 0 ? tabs : []
}

export function filterTabs<T extends { id: string }>(tabs: T[], allowed: string[] | null): T[] {
  if (!allowed) return tabs
  const filtered = tabs.filter((t) => allowed.includes(t.id))
  return filtered.length > 0 ? filtered : tabs.slice(0, 1)
}
