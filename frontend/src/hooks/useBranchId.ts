export function useBranchId() {
  try {
    const raw = localStorage.getItem('session')
    if (raw) return JSON.parse(raw).branch_id || 1
  } catch {
    /* ignore */
  }
  return 1
}
