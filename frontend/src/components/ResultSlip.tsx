import { formatDate } from '../lib/format'
import letterhead from '../assets/letterhead.png'

type Props = {
  title: string
  patientName: string
  uhid: string
  age?: number | string | null
  gender?: string
  date?: string | null
  doctorName?: string
  bodyLabel: string
  bodyText: string
  // Optional — lets a report have a doctor-filled exam type in the title
  // (e.g. "X-RAY (CHEST)"), a separate Impression section, and a named
  // reporter signature, matching the hospital's existing paper report format.
  // When left unset, the slip renders exactly as it always has (used by
  // Lab's plain free-text fallback).
  examType?: string
  impression?: string
  reporterName?: string
  reporterTitle?: string
  // true when bodyText is rich-text HTML from RichTextEditor rather than
  // plain text — renders it as markup instead of escaping/pre-wrapping it.
  bodyIsHtml?: boolean
  // true renders the report visible on screen (not just print-only) — used
  // when reusing this component to view an already-saved result read-only
  // (e.g. from Patient History / Ward Dashboard), matching LabTemplateResult's
  // own `readOnly` prop.
  readOnly?: boolean
}

function isHtmlBlank(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').trim().length === 0
}

export default function ResultSlip({
  title, patientName, uhid, age, gender, date, doctorName, bodyLabel, bodyText,
  examType, impression, reporterName, reporterTitle, bodyIsHtml, readOnly,
}: Props) {
  return (
    <>
      <div className="no-print flex justify-end">
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>Print</button>
      </div>
      <div className={`${readOnly ? '' : 'print-only hidden'} p-8`}>
        <img src={letterhead} alt="Shwe Muse Hospital" className="w-full mb-4" />
        <div className="text-center text-lg font-bold mb-3 uppercase">
          {title}{examType?.trim() ? ` (${examType.trim().toUpperCase()})` : ''}
        </div>
        <table className="w-full text-sm border-collapse mb-3">
          <tbody>
            <tr>
              <td className="border border-slate-400 px-2 py-1 w-1/2">NAME: <strong>{patientName}</strong> (ID: {uhid})</td>
              <td className="border border-slate-400 px-2 py-1">AGE/SEX: <strong>{(age || age === 0) ? age : '—'} / {gender || '—'}</strong></td>
            </tr>
            <tr>
              <td className="border border-slate-400 px-2 py-1">REFERRING PHYSICIAN: <strong>{doctorName || '—'}</strong></td>
              <td className="border border-slate-400 px-2 py-1">DATE: <strong>{date ? formatDate(date) : formatDate(new Date().toISOString())}</strong></td>
            </tr>
          </tbody>
        </table>
        <div className="text-sm font-medium text-slate-600 mb-1">{bodyLabel}</div>
        {bodyIsHtml ? (
          <div
            className="min-h-[500px] text-sm [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            dangerouslySetInnerHTML={{ __html: isHtmlBlank(bodyText) ? '—' : bodyText }}
          />
        ) : (
          <div className="whitespace-pre-wrap min-h-[500px] text-sm">{bodyText || '—'}</div>
        )}
        {impression?.trim() && (
          <div className="mt-4">
            <div className="text-sm font-bold underline mb-1">IMPRESSION</div>
            <div className="whitespace-pre-wrap text-sm font-medium">{impression}</div>
          </div>
        )}
        {reporterName?.trim() ? (
          <div className="flex justify-end mt-10 text-sm">
            <div className="text-right">
              _____________________<br />
              <strong>{reporterName}</strong><br />
              {reporterTitle || 'Radiologist'}
            </div>
          </div>
        ) : (
          <div className="flex justify-between mt-10 text-sm">
            <div>_____________________<br />Technician signature</div>
            <div>_____________________<br />Date</div>
          </div>
        )}
      </div>
    </>
  )
}
