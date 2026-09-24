import { createClient } from '@/lib/supabase/server'
import { fetchFilteredInvoices, failureReasonLabel } from '@/lib/invoices'

const GATEWAY_LABELS = { paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', stripe: 'Card (Stripe)', bank: 'Bank Transfer' }

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function GET(request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return new Response('Forbidden', { status: 403 })

  const { searchParams } = new URL(request.url)
  const { invoices } = await fetchFilteredInvoices(supabase, {
    status: searchParams.get('status'),
    page: searchParams.get('page'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    gateway: searchParams.get('gateway'),
    q: searchParams.get('q'),
  })

  const headers = ['Invoice #', 'Date & Time', 'Page', 'Donor', 'Email', 'Country', 'Gateway', 'Transaction ID', 'Status', 'Failure Reason', 'Currency', 'Amount']
  const rows = invoices.map((d) => [
    d.invoice_number,
    new Date(d.created_at).toISOString(),
    'BlessedHands',
    d.is_anonymous ? 'Anonymous' : d.donor_name || '',
    d.donor_email || '',
    d.donor_country || '',
    GATEWAY_LABELS[d.gateway] || d.gateway,
    d.gateway_reference || '',
    d.status,
    failureReasonLabel(d) || '',
    d.currency,
    Number(d.amount).toFixed(2),
  ])

  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
  const stamp = new Date().toISOString().slice(0, 10)

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="invoices-${stamp}.csv"`,
    },
  })
}
