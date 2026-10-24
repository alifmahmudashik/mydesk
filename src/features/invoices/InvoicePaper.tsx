import { forwardRef } from 'react'
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

const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}

const visible = (fields: InvoiceField[] = []) => fields.filter((f) => f.label.trim() || f.value.trim())

/**
 * The invoice document, in the design's .paper style. Always white (never themed) so the
 * screen preview and the exported PDF look identical, with the client's brand colour.
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

  return (
    <div ref={ref} className="paper" style={{ ['--brand' as string]: brand, maxWidth: 680 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h3>{p.settings?.business_name || 'Your business name'}</h3>
          <div style={{ marginTop: 6, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{p.settings?.business_address}</div>
        </div>
        <div className="big">INVOICE</div>
      </div>

      <div className="row between" style={{ alignItems: 'flex-start', marginTop: 28, gap: 24 }}>
        <div style={{ lineHeight: 1.6, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#6B6B78', marginBottom: 4 }}>INVOICE TO</div>
          <b style={{ color: '#0F0F14' }}>{toName}</b>
          {addressLines.length > 0
            ? addressLines.map((l, i) => <div key={i}>{l}</div>)
            : [p.client?.email, p.client?.phone, p.client?.country].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
          {visible(p.client?.invoice_fields).map((f, i) => (
            <div key={i}>
              <b>{f.label}:</b> {f.value}
            </div>
          ))}
        </div>
        <div style={{ lineHeight: 1.8, textAlign: 'right', whiteSpace: 'nowrap' }}>
          <div><b>Invoice ID:</b> {p.number || '—'}</div>
          <div><b>Invoice date:</b> {p.issueDate ? formatDateLong(p.issueDate) : '—'}</div>
          <div><b>Due date:</b> {p.dueDate ? formatDateLong(p.dueDate) : '—'}</div>
        </div>
      </div>

      {/* html2canvas squares off rounded backgrounds; clipping a wrapper keeps the corners. */}
      <div style={{ overflow: 'hidden', borderRadius: '5px 5px 0 0', marginTop: 24 }}>
        <table style={{ marginTop: 0, borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th style={{ textAlign: 'right' }}>PRICE</th>
              <th style={{ textAlign: 'right' }}>QTY</th>
              <th style={{ textAlign: 'right' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {p.lineItems.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: '#8B8B96' }}>No line items yet.</td>
              </tr>
            ) : (
              p.lineItems.map((li, i) => (
                <tr key={i}>
                  <td>{li.description || '—'}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(Number(li.price), p.currency)}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{li.qty}</td>
                  <td className="num" style={{ textAlign: 'right' }}>{money(Number(li.price) * Number(li.qty), p.currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="row between" style={{ alignItems: 'flex-start', gap: 24, marginTop: 4 }}>
        <div style={{ marginTop: 16, lineHeight: 1.6, minWidth: 0 }}>
          {visible(p.paymentFields).length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#6B6B78', marginBottom: 4 }}>PAYMENT{p.paymentName ? ` · ${p.paymentName.toUpperCase()}` : ''}</div>
              {visible(p.paymentFields).map((f, i) => (
                <div key={i}>
                  <span style={{ color: '#6B6B78' }}>{f.label}:</span> {f.value}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="tot">
          <div><span>Sub-total</span><span className="num">{money(subtotal, p.currency)}</span></div>
          <div><span>Tax ({Number(p.taxRate)}%)</span><span className="num">{money(tax, p.currency)}</span></div>
          <div style={{ overflow: 'hidden', borderRadius: 5 }}>
            <div className="grand" style={{ marginTop: 0, width: '100%' }}><span>Total</span><span className="num">{money(total, p.currency)}</span></div>
          </div>
        </div>
      </div>

      {p.notes && (
        <div style={{ marginTop: 32, lineHeight: 1.6 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', color: '#6B6B78', marginBottom: 4 }}>NOTE</div>
          {p.notes}
        </div>
      )}
    </div>
  )
})
