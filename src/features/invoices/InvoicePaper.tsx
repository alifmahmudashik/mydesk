import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { formatDateLong } from '@/lib/format'
import type { Client, InvoiceField, InvoiceLineItem, InvoiceSettings } from '@/types'

export interface InvoicePaperProps {
  number: string
  issueDate?: string | null
  dueDate?: string | null
  currency: string
  lineItems: InvoiceLineItem[]
  taxRate: number
  notes?: string | null
  brandColor?: string | null
  client?: Client
  settings: InvoiceSettings | null
  paymentFields: InvoiceField[]
  paymentName?: string
}

/** A4 at 96 DPI. The invoice is always laid out at this size, then scaled to fit on screen. */
export const A4_WIDTH = 794
export const A4_HEIGHT = 1123

const INK = '#18181B'
const MUTED = '#71717A'
const LINE = '#D4D4D8'

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

const visible = (fields: InvoiceField[] = []) => fields.filter((f) => f.label.trim() || f.value.trim())

const caps = { fontSize: 15, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: MUTED }

/**
 * The invoice document: a full A4 page, always white and never themed, so the on-screen
 * preview and the exported PDF are identical. Brand colour comes from the client/invoice.
 */
export const InvoicePaper = forwardRef<HTMLDivElement, InvoicePaperProps>(function InvoicePaper(p, ref) {
  const subtotal = p.lineItems.reduce((s, li) => s + Number(li.price) * Number(li.qty), 0)
  const tax = subtotal * (Number(p.taxRate) / 100)
  const total = subtotal + tax
  const brand = p.brandColor || '#4F46E5'

  // The address's first line is the client's legal invoicing name (often longer than the display name).
  const lines = (p.client?.company_address ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const [legalName, ...addressLines] = lines
  const toName = legalName || (p.client?.use_company_name && p.client.company_name ? p.client.company_name : p.client?.name ?? '—')
  const pay = visible(p.paymentFields)

  const th = { padding: '13px 16px', fontSize: 15, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' as const, color: '#fff', textAlign: 'right' as const }
  const td = { padding: '13px 16px', borderBottom: `1px solid ${LINE}`, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }

  return (
    <div
      ref={ref}
      className="inv-doc"
      style={{
        width: A4_WIDTH,
        minHeight: A4_HEIGHT,
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        color: INK,
        fontFamily: "'Geist', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: 16,
        lineHeight: 1.55,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
        <div>
          <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1.15, marginBottom: 8 }}>{p.settings?.business_name || 'Your business name'}</div>
          {(p.settings?.business_address ?? '').split('\n').filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: brand }}>INVOICE</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginTop: 36 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...caps, marginBottom: 4 }}>Invoice to</div>
          <div style={{ fontWeight: 700 }}>{toName}</div>
          {addressLines.length > 0
            ? addressLines.map((l, i) => <div key={i}>{l}</div>)
            : [p.client?.email, p.client?.phone, p.client?.country].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
          {visible(p.client?.invoice_fields).map((f, i) => (
            <div key={i}><b>{f.label}:</b> {f.value}</div>
          ))}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div><b>Invoice ID:</b> {p.number || '—'}</div>
          <div><b>Invoice Date:</b> {p.issueDate ? formatDateLong(p.issueDate) : '—'}</div>
          <div><b>Due Date:</b> {p.dueDate ? formatDateLong(p.dueDate) : '—'}</div>
        </div>
      </div>

      {/* html2canvas squares off rounded backgrounds; clipping a wrapper keeps the corners. */}
      <div style={{ marginTop: 36, overflow: 'hidden', borderRadius: '8px 8px 0 0' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: brand }}>
              <th style={{ ...th, textAlign: 'left' }}>Product</th>
              <th style={th}>Price</th>
              <th style={th}>Qty</th>
              <th style={th}>Total</th>
            </tr>
          </thead>
          <tbody>
            {p.lineItems.length === 0 ? (
              <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: MUTED }}>No line items yet.</td></tr>
            ) : (
              p.lineItems.map((li, i) => (
                <tr key={i}>
                  <td style={{ ...td, textAlign: 'left' }}>{li.description || '—'}</td>
                  <td style={td}>{money(Number(li.price), p.currency)}</td>
                  <td style={td}>{li.qty}</td>
                  <td style={td}>{money(Number(li.price) * Number(li.qty), p.currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payment method sits level with the totals, right under the table. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32, marginTop: 32 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {pay.length > 0 && (
            <>
              <div style={{ ...caps, marginBottom: 12 }}>Payment Method</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pay.map((f, i) => (
                  <div key={i}>
                    <div style={{ fontWeight: 700 }}>{f.label}</div>
                    <div style={{ whiteSpace: 'pre-line' }}>{f.value}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        <div style={{ width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Row label="Sub-total" value={money(subtotal, p.currency)} />
          <Row label={`Tax (${Number(p.taxRate)}%)`} value={money(tax, p.currency)} />
          <div style={{ overflow: 'hidden', borderRadius: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', background: brand, color: '#fff', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(total, p.currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {p.notes && (
        <div style={{ marginTop: 'auto', paddingTop: 32 }}>
          <div style={{ ...caps, marginBottom: 4 }}>Note</div>
          <div style={{ whiteSpace: 'pre-line' }}>{p.notes}</div>
        </div>
      )}
    </div>
  )
})

function Row({ label, value }: { label: ReactNode; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}

/** Shows the A4 invoice scaled down to fit its container (never scaled up). */
export function ScaledInvoice(props: InvoicePaperProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(A4_HEIGHT)

  useEffect(() => {
    const frame = frameRef.current
    const page = pageRef.current
    if (!frame || !page) return
    const update = () => {
      const s = Math.min(1, frame.clientWidth / A4_WIDTH)
      setScale(s)
      setHeight(page.offsetHeight * s)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(frame)
    ro.observe(page)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={frameRef} style={{ width: '100%' }}>
      <div style={{ height, width: A4_WIDTH * scale, margin: '0 auto', boxShadow: '0 1px 2px rgba(16,16,24,.06), 0 12px 32px rgba(16,16,24,.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: A4_WIDTH }}>
          <InvoicePaper ref={pageRef} {...props} />
        </div>
      </div>
    </div>
  )
}
