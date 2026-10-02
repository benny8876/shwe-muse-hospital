import { formatDate } from '../lib/format'
import letterhead from '../assets/letterhead.png'
import { LAB_SECTION_BG } from './LabTemplateResult'

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
        <div className="grid grid-cols-2 gap-1 text-sm border-t border-b py-2 mb-3">
          <div>Patient's Name: <strong>{patientName}</strong></div>
          <div>Received Date: <strong>{date ? formatDate(date) : formatDate(new Date().toISOString())}</strong></div>
          <div>Age & Gender: <strong>{(age || age === 0) ? age : '—'} / {gender || '—'}</strong></div>
          <div>Reported Date: <strong>{formatDate(new Date().toISOString())}</strong></div>
          <div>ID: <strong>{uhid}</strong></div>
          {doctorName && <div>Referred by (Dr.): <strong>{doctorName}</strong></div>}
        </div>
        <div className="text-center text-lg font-bold py-1 mb-3 uppercase" style={{ background: LAB_SECTION_BG }}>
          {title}{examType?.trim() ? ` (${examType.trim().toUpperCase()})` : ''}
        </div>
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
