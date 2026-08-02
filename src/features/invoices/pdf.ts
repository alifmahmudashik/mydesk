/** Renders a DOM node to a single-page PDF sized to match it exactly, then downloads it.
 *  jsPDF/html2canvas are ~230kB combined — only admins export invoices, so load them
 *  on demand instead of bloating everyone's initial bundle. */
export async function exportElementToPdf(el: HTMLElement, filename: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas-pro'),
    import('jspdf'),
  ])
  const scale = 2
  const canvas = await html2canvas(el, { scale, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')
  const pxToMm = 25.4 / 96
  const widthMm = (canvas.width / scale) * pxToMm
  const heightMm = (canvas.height / scale) * pxToMm
  const pdf = new jsPDF({
    orientation: widthMm > heightMm ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [widthMm, heightMm],
  })
  pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm)
  pdf.save(filename)
}
