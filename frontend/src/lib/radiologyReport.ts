// X-ray/USG findings are stored as plain text in RadiologyOrder.findings — no
// backend schema change needed for the extra report fields (exam type filler,
// impression, reporting doctor). We just encode/decode a small JSON shape
// into that same text column, matching the pattern Lab already uses for its
// structured template values (JSON.stringify into a Text column).
export type RadiologyReportData = {
  examType: string
  body: string
  impression: string
  reporterName: string
}

const EMPTY: RadiologyReportData = { examType: '', body: '', impression: '', reporterName: '' }

export function parseRadiologyFindings(raw: string | null | undefined): RadiologyReportData {
  if (!raw) return { ...EMPTY }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof parsed.body === 'string') {
      return {
        examType: parsed.examType || '',
        body: parsed.body || '',
        impression: parsed.impression || '',
        reporterName: parsed.reporterName || '',
      }
    }
  } catch {
    // legacy plain-text findings saved before this JSON shape existed — fall through
  }
  return { ...EMPTY, body: raw }
}

export function serializeRadiologyFindings(data: RadiologyReportData): string {
  return JSON.stringify(data)
}

// Quick-insert chips for the rich-text Findings box — click a label/phrase to
// drop it in at the cursor instead of retyping it, since radiology reports
// reuse the same organ labels / normal phrases on almost every case (see the
// hospital's own paper USG report format this mirrors). HTML (not plain text
// with \n) since RichTextEditor.insertHtml() inserts via execCommand.
export const XRAY_QUICK_SNIPPETS: { label: string; snippet: string }[] = [
  { label: 'Normal Chest', snippet: '<div>Heart size and cardiac silhouette are normal.</div><div>Lung fields are clear bilaterally.</div><div>No evidence of consolidation, pleural effusion, or pneumothorax.</div><div>Bony thorax intact.</div>' },
  { label: 'Normal Limb', snippet: '<div>No fracture or dislocation seen.</div><div>Bone density and alignment normal.</div><div>Soft tissue shadows unremarkable.</div>' },
  { label: 'Normal Skull', snippet: '<div>Skull bones intact, no fracture seen.</div><div>No abnormal calcification.</div><div>Sella turcica normal in size and shape.</div>' },
  { label: 'Normal Abdomen', snippet: '<div>Bowel gas pattern normal.</div><div>No abnormal calcification or free air seen.</div><div>Psoas shadows and bony pelvis unremarkable.</div>' },
  { label: 'No abnormality detected', snippet: '<div>No abnormality detected.</div>' },
]

export const USG_QUICK_SNIPPETS: { label: string; snippet: string }[] = [
  { label: 'LIVER', snippet: '<div><strong>LIVER:</strong> is normal in size and shows normal echotexture, no SOL.</div>' },
  { label: 'PV', snippet: '<div><strong>PV:</strong> normal caliber, thrombus (-).</div>' },
  { label: 'CBD', snippet: '<div><strong>CBD:</strong> normal caliber, stone (-).</div>' },
  { label: 'GB', snippet: '<div><strong>GB:</strong> normal wall thickness, no sludge / calculus.</div>' },
  { label: 'SPLEEN', snippet: '<div><strong>SPLEEN:</strong> is normal in size, no SOL.</div>' },
  { label: 'PANCREAS', snippet: '<div><strong>PANCREAS:</strong> shows normal echo, no SOL.</div>' },
  { label: 'KIDNEYS', snippet: '<div><strong>KIDNEYS:</strong> Right kidney - normal in size, hydronephrosis (-), calculus (-), no SOL.</div><div>Left kidney - normal in size, CMJ is maintained, hydronephrosis (-), calculus (-).</div>' },
  { label: 'UB', snippet: '<div><strong>UB:</strong> normal wall thickness, no calculus / debris.</div>' },
  { label: 'PROSTATE', snippet: '<div><strong>PROSTATE:</strong> normal volume, no SOL.</div>' },
  { label: 'No free fluid', snippet: '<div>No free fluid and bowel mass.</div>' },
]
