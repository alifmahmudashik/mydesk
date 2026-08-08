import { useEffect, useState } from 'react'

const RATES_CACHE_KEY = 'mydesk-usd-rates-v1'
const CACHE_TTL_MS = 12 * 60 * 60 * 1000 // 12h — free API, no need to hit it more than that

interface RatesCache {
  /** 1 USD = rates[CUR] units of CUR. */
  rates: Record<string, number>
  fetchedAt: number
}

function loadCachedRates(): Record<string, number> | null {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as RatesCache
    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null
    return cache.rates
  } catch {
    return null
  }
}

function saveCachedRates(rates: Record<string, number>) {
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ rates, fetchedAt: Date.now() } satisfies RatesCache))
  } catch {
    // localStorage full/unavailable — rates just get re-fetched next load
  }
}

/** Free, no-API-key exchange rate feed (updated daily) — fine for rough USD roll-ups. */
async function fetchRates(): Promise<Record<string, number>> {
  const res = await fetch('https://open.er-api.com/v6/latest/USD')
  if (!res.ok) throw new Error('Failed to fetch exchange rates')
  const data = await res.json()
  if (data.result !== 'success' || !data.rates) throw new Error('Unexpected exchange rate response')
  return data.rates as Record<string, number>
}

/** Loads USD exchange rates, updating a same-day cache so repeat visits don't refetch. */
export function useUsdRates() {
  const [rates, setRates] = useState<Record<string, number> | null>(() => loadCachedRates())

  useEffect(() => {
    if (rates) return
    let cancelled = false
    fetchRates()
      .then((r) => {
        if (cancelled) return
        saveCachedRates(r)
        setRates(r)
      })
      .catch(() => {
        // Offline or the free API is down — totals just fall back to a naive sum below.
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return rates
}

/** Converts an amount into USD. Falls back to the raw amount (best effort) if rates
 *  haven't loaded yet or the currency is unrecognized — self-corrects once they arrive. */
export function toUSD(amount: number, currency: string, rates: Record<string, number> | null): number {
  if (currency === 'USD') return amount
  const rate = rates?.[currency]
  return rate ? amount / rate : amount
}

/** Total value of a list of {amount, currency} rows, all converted to USD. */
export function sumUSD(items: { amount: number; currency: string }[], rates: Record<string, number> | null): number {
  return items.reduce((sum, it) => sum + toUSD(it.amount, it.currency, rates), 0)
}
