type Props = {
  name: string
  uhid: string
}

/**
 * A small wristband/sticker label (~80mm x 30mm) showing just Name + ID,
 * printed right after registration and attached to the patient's wrist.
 *
 * Printed via a hidden, dedicated <iframe> with its own document (its own
 * @page size, its own body) instead of hiding/overriding the main page's
 * CSS in place — hiding-in-place is fragile (stacking contexts, transforms,
 * timing) and can silently print the whole page instead. The iframe's
 * content and its <iframe> element are both removed right after printing,
 * so this never affects the normal-paper ResultSlip printing used by
 * Lab/X-ray/USG.
 */
export default function RegistrationLabel({ name, uhid }: Props) {
  function printLabel() {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    if (!doc) {
      iframe.remove()
      return
    }

    doc.open()
    doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Label</title>
<style>
  @page { size: 80mm 30mm; margin: 0; }
  html, body { margin: 0; padding: 0; }
  body {
    width: 80mm;
    height: 30mm;
    box-sizing: border-box;
    padding: 2.5mm 3mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    font-family: "Padauk", "Noto Sans Myanmar", system-ui, sans-serif;
    color: #000;
  }
  .hospital { font-size: 7.5pt; font-weight: 600; letter-spacing: 0.3pt; text-transform: uppercase; color: #444; }
  .rule { border-top: 0.5pt solid #000; margin: 1mm 0 1.5mm; }
  .row { display: flex; align-items: baseline; gap: 2mm; }
  .row + .row { margin-top: 1mm; }
  .field-label { font-size: 9pt; font-weight: 600; width: 11mm; flex-shrink: 0; }
  .field-value { font-size: 13pt; font-weight: 700; line-height: 1.1; word-break: break-word; }
  .row.id .field-value { letter-spacing: 0.4pt; }
</style>
</head>
<body>
  <div class="hospital">Shwe Muse Hospital</div>
  <div class="rule"></div>
  <div class="row name">
    <span class="field-label">Name:</span>
    <span class="field-value">${escapeHtml(name)}</span>
  </div>
  <div class="row id">
    <span class="field-label">ID:</span>
    <span class="field-value">${escapeHtml(uhid)}</span>
  </div>
</body>
</html>`)
    doc.close()

    const cleanup = () => iframe.remove()
    iframe.onload = () => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
      window.setTimeout(cleanup, 1000)
    }
  }

  return (
    <button type="button" className="btn btn-secondary btn-sm" onClick={printLabel}>🏷 Print Wristband Label</button>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
