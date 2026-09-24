import { useParams } from 'react-router-dom'
import LabReportView from '../components/LabReportView'

// Standalone page (no counter sidebar) — a permalink/printable view of a
// single lab order, reachable by URL. Patient History opens the same content
// in an in-app modal instead (see PatientMedicalHistoryPanel) so staff aren't
// dropped into a separate browser tab, which is awkward once this runs as a PWA.
export default function LabReportViewPage() {
  const { orderId } = useParams()
  if (!orderId) return null

  return (
    <div className="max-w-4xl mx-auto p-6">
      <LabReportView orderId={orderId} />
    </div>
  )
}
