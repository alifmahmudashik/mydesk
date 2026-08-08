import { forwardRef } from 'react'
import { formatDate } from '@/lib/format'
import type { Client, InvoiceField, InvoiceLineItem, InvoiceSettings } from '@/types'

interface InvoicePreviewProps {
  number: string
  issueDate: string
  dueDate: string
  currency: string
  lineItems: InvoiceLineItem[]
  taxRate: number
  notes: string
  brandColor: string
  client: Client | undefined
  settings: InvoiceSettings | null
  paymentFields: InvoiceField[]
}

/** Matches the app's --font-sans exactly, so the on-screen preview and the exported PDF
 *  both render actual Inter rather than falling back to a generic system sans-serif. */
const FONT_STACK = "'Inter Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"

const money = (n: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)

/** Compact "Label: value" inline rows — used inside the tight invoice-to address block. */
function FieldRows({ fields }: { fields: InvoiceField[] }) {
  if (fields.length === 0) return null
  return (
    <>
      {fields
        .filter((f) => f.label.trim() || f.value.trim())
        .map((f, i) => (
          <p key={i}>
            <span className="font-semibold">{f.label}: </span>
            {f.value}
          </p>
        ))}
    </>
  )
}

/** Label on its own bold line, value on the line below, with real breathing room between
 *  entries — used for Payment Method, where each field needs to read as its own block. */
function StackedFieldRows({ fields }: { fields: InvoiceField[] }) {
  const visible = fields.filter((f) => f.label.trim() || f.value.trim())
  if (visible.length === 0) return null
  return (
    <div className="space-y-3">
      {visible.map((f, i) => (
        <div key={i}>
          <p className="font-bold">{f.label}</p>
          <p>{f.value}</p>
        </div>
      ))}
    </div>
  )
}

/**
 * The invoice document itself — plain inline-friendly markup (no app theme tokens) so it
 * renders identically on screen and in the exported PDF, and so a client's brand_color
 * shows through regardless of the viewer's light/dark mode.
 */
export const InvoicePreview = forwardRef<HTMLDivElement, InvoicePreviewProps>(function InvoicePreview(
  { number, issueDate, dueDate, currency, lineItems, taxRate, notes, brandColor, client, settings, paymentFields },
  ref,
) {
  const subtotal = lineItems.reduce((sum, li) => sum + li.price * li.qty, 0)
  const tax = subtotal * (taxRate / 100)
  const total = subtotal + tax
  const color = brandColor || '#111111'

  return (
    <div
      ref={ref}
      style={{ background: '#ffffff', color: '#18181b', fontFamily: FONT_STACK }}
      className="flex w-[210mm] min-h-[297mm] max-w-full flex-col p-12 text-base leading-relaxed"
    >
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="mb-2 text-4xl font-extrabold tracking-tight">{settings?.business_name || 'Your Business Name'}</p>
          {settings?.business_address?.split('\n').map((line, i) => <p key={i}>{line}</p>)}
        </div>
        <h1 className="text-5xl font-bold tracking-tight" style={{ color }}>
          INVOICE
        </h1>
      </div>

      <div className="mt-8 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="mb-1 text-base font-bold uppercase tracking-wider text-zinc-500">Invoice to</p>
          <p className="font-bold">{client?.use_company_name && client.company_name ? client.company_name : (client?.name ?? '—')}</p>
          {client?.company_address ? (
            client.company_address.split('\n').map((line, i) => <p key={i}>{line}</p>)
          ) : (
            <>
              {client?.email && <p>{client.email}</p>}
              {client?.phone && <p>{client.phone}</p>}
              {client?.country && <p>{client.country}</p>}
            </>
          )}
          {client?.invoice_fields && <FieldRows fields={client.invoice_fields} />}
        </div>
        <div className="shrink-0 text-right">
          <p>
            <span className="font-semibold">Invoice ID: </span>
            {number || '—'}
          </p>
          <p>
            <span className="font-semibold">Invoice Date: </span>
            {issueDate ? formatDate(issueDate) : '—'}
          </p>
          <p>
            <span className="font-semibold">Due Date: </span>
            {dueDate ? formatDate(dueDate) : '—'}
          </p>
        </div>
      </div>

      {/* html2canvas doesn't reliably rasterize border-radius combined with a background
          color (confirmed: it silently squares off both this header and the Total pill
          below) — overflow-hidden on a wrapper clips it instead, which canvas renderers
          handle correctly since it's a real clip path, not a rounded-rect fill. */}
      <div className="mt-8 overflow-hidden rounded-t-lg">
        <table className="w-full text-left" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: color }} className="text-white">
              <th className="px-4 py-3 text-base font-bold uppercase tracking-wider">Product</th>
              <th className="px-4 py-3 text-right text-base font-bold uppercase tracking-wider">Price</th>
              <th className="px-4 py-3 text-right text-base font-bold uppercase tracking-wider">Qty</th>
              <th className="px-4 py-3 text-right text-base font-bold uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-zinc-400">
                  No line items yet.
                </td>
              </tr>
            ) : (
              // The border lives on each <td>, not the <tr>: under border-collapse: separate
              // (needed above so the wrapper's rounded corners don't get clipped by collapsed
              // borders), row-level borders on a <tr> aren't reliably painted — cell borders
              // are the only ones guaranteed to render.
              lineItems.map((li, i) => (
                <tr key={i}>
                  <td className="border-b border-zinc-300 px-4 py-3">{li.description || '—'}</td>
                  <td className="tnum border-b border-zinc-300 px-4 py-3 text-right">{money(li.price, currency)}</td>
                  <td className="tnum border-b border-zinc-300 px-4 py-3 text-right">{li.qty}</td>
                  <td className="tnum border-b border-zinc-300 px-4 py-3 text-right">{money(li.price * li.qty, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Payment method sits level with the totals — both start right after the table,
          instead of one being stranded near the bottom of the page. */}
      <div className="mt-8 flex items-start justify-between gap-8">
        <div className="min-w-0 flex-1">
          {paymentFields.length > 0 && (
            <>
              <p className="mb-3 text-base font-bold uppercase tracking-wider text-zinc-500">Payment Method</p>
              <StackedFieldRows fields={paymentFields} />
            </>
          )}
        </div>
        <div className="w-64 shrink-0 space-y-2">
          <div className="flex justify-between">
            <span className="text-zinc-500">Sub-total</span>
            <span className="tnum">{money(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Tax ({taxRate}%)</span>
            <span className="tnum">{money(tax, currency)}</span>
          </div>
          <div className="overflow-hidden rounded-md">
            <div className="flex justify-between px-4 py-2.5 font-bold text-white" style={{ background: color }}>
              <span>Total</span>
              <span className="tnum">{money(total, currency)}</span>
            </div>
          </div>
        </div>
      </div>

      {notes && (
        <div className="mt-auto pt-8">
          <p className="mb-1 text-base font-bold uppercase tracking-wider text-zinc-500">Note</p>
          <p>{notes}</p>
        </div>
      )}
    </div>
  )
})
