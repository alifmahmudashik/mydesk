/** Renders a DOM node to a real A4 PDF (paginating if the content runs long), then downloads it.
 *  jsPDF/html2canvas are ~230kB combined — only admins export invoices, so load them
 *  on demand instead of bloating everyone's initial bundle. */
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])
  // Wait for Inter to finish loading — otherwise a capture mid-swap can rasterize the
  // browser's fallback system font instead of the one actually shown on screen.
  await document.fonts.ready

  // 300 DPI (print quality) at the browser's baseline 96 DPI — anything lower reads as
  // soft/blurry once exported, especially on retina screens or when printed.
  const scale = 300 / 96
  const canvas = await html2canvas(el, { scale, backgroundColor: '#ffffff' })
  // JPEG, not PNG: this is a near-solid-white document, and PNG's lossless compression
  // does badly on the anti-aliased text/gradients html2canvas produces at high scale —
  // it was ballooning a one-page invoice to 20MB+. JPEG at high quality is visually
  // identical here and comes in at a few hundred KB.
  const imgData = canvas.toDataURL('image/jpeg', 0.92)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgHeight = (canvas.height * pageWidth) / canvas.width

  // A single page's worth of rounding slop (content a fraction of a mm over one page
  // shouldn't spawn an all-but-empty second page).
  if (imgHeight <= pageHeight + 1) {
    pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, imgHeight)
  } else {
    // Content runs past one A4 page — add the same full image on each page, shifted up
    // by a page height each time; jsPDF clips whatever falls outside the page bounds.
    let offset = 0
    let first = true
    while (offset < imgHeight) {
      if (!first) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, -offset, pageWidth, imgHeight)
      offset += pageHeight
      first = false
    }
  }
  pdf.save(filename)
}
