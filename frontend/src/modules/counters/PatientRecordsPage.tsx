import { Link } from 'react-router-dom'
import { useBranchId } from '../../hooks/useBranchId'
import PatientMedicalHistoryPanel from '../../components/PatientMedicalHistoryPanel'

export default function PatientRecordsPage() {
  const branchId = useBranchId()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-slate-600 max-w-2xl">
          လူနာ ရှာပြီး အရင်က ဘယ်နေ့ လာခဲ့တယ်၊ ဘာကုထားတယ်ဆိုတာ ကြည့်ပါ။ Register လုပ်မယ်ဆိုရင် လူနာရွေးပြီး Register Visit နှိပ်ပါ။
        </p>
        <Link to="/counter/reception" className="btn btn-secondary btn-sm shrink-0">
          → Reception Register
        </Link>
      </div>
      <PatientMedicalHistoryPanel branchId={branchId} showRegisterVisit />
    </div>
  )
}
