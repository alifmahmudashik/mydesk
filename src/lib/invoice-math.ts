import type { InvoiceLineItem } from '@/types'

export interface InvoiceMathInput {
  line_items: InvoiceLineItem[]
  tax_rate?: number | string | null
  /** Payment provider's percentage cut, e.g. 4.4 for PayPal. */
  fee_percent?: number | string | null
  /** Payment provider's fixed fee per payment, e.g. 0.30. */
  fee_flat?: number | string | null
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * Sub-total, tax and an optional processing fee. The fee is "grossed up": it's sized so that
 * after the provider takes its percentage + flat fee from the total, you still receive the
 * full amount before fees.
 */
export function invoiceAmounts(inv: InvoiceMathInput) {
  const subtotal = inv.line_items.reduce((s, li) => s + Number(li.price) * Number(li.qty), 0)
  const tax = subtotal * (Number(inv.tax_rate) || 0) / 100
  const base = subtotal + tax
  const pct = Math.min(Math.max(Number(inv.fee_percent) || 0, 0), 95)
  const flat = Math.max(Number(inv.fee_flat) || 0, 0)
  const fee = base > 0 && (pct > 0 || flat > 0) ? r2((base + flat) / (1 - pct / 100) - base) : 0
  return { subtotal, tax, base, fee, total: base + fee, receive: base, pct, flat }
}

export function invoiceTotal(inv: InvoiceMathInput) {
  return invoiceAmounts(inv).total
}
