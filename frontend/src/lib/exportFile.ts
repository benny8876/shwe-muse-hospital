import api from './api'

// Shared by every "Export Excel" / "Export PDF" button — GETs a file as a
// blob (so the request carries the normal Authorization header, unlike
// window.open) and triggers a browser download with the given filename.
export async function downloadFile(url: string, params: Record<string, unknown>, filename: string) {
  const res = await api.get(url, { params, responseType: 'blob' })
  const blobUrl = window.URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(blobUrl)
}
