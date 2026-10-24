/** Renders a DOM node to an A4 PDF (paginating if it runs long). jsPDF/html2canvas are
 *  ~230kB, so they load on demand instead of bloating everyone's first page load. */
async function renderPdf(el: HTMLElement) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  // Wait for web fonts, or the capture can rasterize a fallback font mid-swap.
  await document.fonts.ready
  // 300 DPI over the browser's 96 baseline: anything lower looks soft once printed.
  const canvas = await html2canvas(el, {
    scale: 300 / 96,
    backgroundColor: '#ffffff',
    // html2canvas renders a copy of the page; a fade-in animation restarting in that copy
    // got captured half-transparent (the old "washed out" PDF). Freeze the invoice only.
    onclone: (_doc, clone) => {
      for (const node of [clone, ...clone.querySelectorAll<HTMLElement>('*')]) {
        node.style.animation = 'none'
        node.style.transition = 'none'
      }
    },
  })
  // JPEG keeps a one-page invoice at a few hundred KB (PNG ballooned to 20MB+).
  const img = canvas.toDataURL('image/jpeg', 0.92)
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const w = pdf.internal.pageSize.getWidth()
  const h = pdf.internal.pageSize.getHeight()
  const imgH = (canvas.height * w) / canvas.width
  if (imgH <= h + 1) {
    pdf.addImage(img, 'JPEG', 0, 0, w, imgH)
  } else {
    for (let offset = 0, first = true; offset < imgH; offset += h, first = false) {
      if (!first) pdf.addPage()
      pdf.addImage(img, 'JPEG', 0, -offset, w, imgH)
    }
  }
  return pdf
}

export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const pdf = await renderPdf(el)
  pdf.save(filename)
}

/** Base64 PDF (no data: prefix), for attaching to a reminder email. */
export async function elementToPdfBase64(el: HTMLElement) {
  const pdf = await renderPdf(el)
  return pdf.output('datauristring').split(',')[1]
}

/** "Alif Mahmud - Lagoon Media - invoice - Aug 8, 2026.pdf", without characters filesystems reject. */
export function invoiceFilename(parts: (string | null | undefined)[], fallback: string) {
  const base = parts.filter(Boolean).join(' - ') || fallback
  return `${base.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()}.pdf`
}
