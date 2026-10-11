import { getPaypalAccounts } from '@/lib/paypalAccounts'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { readPaymentSettings } from '@/lib/paymentSettings'

// Day boundaries for the admin's date filters, in Bangladesh time (no DST, so a
// fixed offset is exact), matching the Traffic page whatever the server's zone.
export const dayStart = (day) => (day ? new Date(`${day}T00:00:00+06:00`) : null)
export const dayEnd = (day) => (day ? new Date(`${day}T23:59:59.999+06:00`) : null)

// account: a saved PayPal account id, or 'none' for invoices with no recorded
// account (or one that has since been removed). Only call after checking the
// viewer is an admin: the settings are read with the service key.
export async function fetchFilteredInvoices(supabase, { status, page, from, to, gateway, q, account } = {}) {
  const [{ data: pages }, { data: donations }, paymentSettings] = await Promise.all([
    supabase.from('pages').select('id, slug, title, label').order('created_at', { ascending: true }),
    fetchAll(() =>
      supabase
        .from('donations')
        .select('invoice_number, donor_name, donor_email, is_anonymous, amount, currency, gateway, gateway_reference, status, failure_reason, failure_code, checkout_step, paypal_account_id, page_id, donor_country, created_at')
        .order('created_at', { ascending: false })
        .order('id')
    ),
    account === 'none' ? readPaymentSettings() : null,
  ])

  const knownAccountIds = new Set(getPaypalAccounts(paymentSettings?.paypal).map((a) => a.id))

  const pageById = Object.fromEntries((pages || []).map((p) => [p.id, p]))
  const fromDate = dayStart(from)
  const toDate = dayEnd(to)
  const needle = q ? q.trim().toLowerCase() : ''

  const invoices = (donations || []).filter((d) => {
    if (status !== 'all' && d.status !== (status || 'completed')) return false
    if (page && page !== 'all' && d.page_id !== page) return false
    if (gateway && gateway !== 'all' && d.gateway !== gateway) return false
    if (account === 'none' && d.paypal_account_id && knownAccountIds.has(d.paypal_account_id)) return false
    if (account && account !== 'all' && account !== 'none' && d.paypal_account_id !== account) return false
    const createdAt = new Date(d.created_at)
    if (fromDate && createdAt < fromDate) return false
    if (toDate && createdAt > toDate) return false
    if (needle) {
      const haystack = `${d.invoice_number || ''} ${d.gateway_reference || ''}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  return { pages: pages || [], pageById, invoices }
}

const FAILURE_REASON_LABELS = {
  cancelled: 'Cancelled by donor',
  checkout_error: 'Checkout error',
  capture_declined: 'Payment declined',
}

const PENDING_STEP_LABELS = {
  form: 'Left before opening PayPal',
  paypal: 'Opened PayPal, didn’t finish',
}

// A donor still paying right now also shows as pending, so recent invoices
// aren't labelled as abandoned yet.
const IN_PROGRESS_MS = 30 * 60 * 1000

// Short explanation shown under a failed or pending status badge, e.g.
// "Payment declined · INSTRUMENT_DECLINED". Null for completed invoices.
// Invoices from before reasons/steps were recorded have neither field set.
export function statusNote(donation) {
  if (donation?.status === 'pending') {
    if (donation.gateway === 'bank') return 'Awaiting bank transfer'
    if (Date.now() - new Date(donation.created_at).getTime() < IN_PROGRESS_MS) return 'Checkout in progress'
    return PENDING_STEP_LABELS[donation.checkout_step] || 'Donor didn’t finish payment'
  }
  if (donation?.status !== 'failed') return null
  if (!donation.failure_reason) return 'Reason not recorded'
  const label = FAILURE_REASON_LABELS[donation.failure_reason] || donation.failure_reason
  return donation.failure_code ? `${label} · ${donation.failure_code}` : label
}
