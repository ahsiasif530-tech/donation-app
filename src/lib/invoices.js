export async function fetchFilteredInvoices(supabase, { status, page, from, to, gateway, q } = {}) {
  const { data: pages } = await supabase
    .from('pages')
    .select('id, slug, title, label')
    .order('created_at', { ascending: true })

  const { data: donations } = await supabase
    .from('donations')
    .select('invoice_number, donor_name, donor_email, is_anonymous, amount, currency, gateway, gateway_reference, status, failure_reason, failure_code, page_id, donor_country, created_at')
    .order('created_at', { ascending: false })

  const pageById = Object.fromEntries((pages || []).map((p) => [p.id, p]))
  const fromDate = from ? new Date(`${from}T00:00:00`) : null
  const toDate = to ? new Date(`${to}T23:59:59`) : null
  const needle = q ? q.trim().toLowerCase() : ''

  const invoices = (donations || []).filter((d) => {
    if (status !== 'all' && d.status !== (status || 'completed')) return false
    if (page && page !== 'all' && d.page_id !== page) return false
    if (gateway && gateway !== 'all' && d.gateway !== gateway) return false
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

// e.g. "Payment declined · INSTRUMENT_DECLINED". Null for non-failed invoices
// and for ones that failed before the reason was being recorded.
export function failureReasonLabel(donation) {
  if (donation?.status !== 'failed' || !donation.failure_reason) return null
  const label = FAILURE_REASON_LABELS[donation.failure_reason] || donation.failure_reason
  return donation.failure_code ? `${label} · ${donation.failure_code}` : label
}
