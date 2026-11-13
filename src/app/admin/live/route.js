import { adminClientOrResponse } from '@/lib/adminGuard'

export const dynamic = 'force-dynamic'

// The latest started and completed donations, for the admin's live alerts
// (a donor reaching checkout, and the payment coming through).
export async function GET() {
  const { supabase, response } = await adminClientOrResponse()
  if (response) return response

  const { data, error } = await supabase
    .from('donations')
    .select('invoice_number, amount, currency, donor_name, is_anonymous, donor_country, status, created_at, pages(label, title, slug)')
    .in('status', ['pending', 'completed'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return Response.json({ error: 'Could not read donations' }, { status: 500 })

  return Response.json(
    {
      latest: (data || []).map((d) => ({
        invoice: d.invoice_number,
        status: d.status,
        amount: Number(d.amount),
        currency: d.currency,
        donor: d.is_anonymous ? 'Anonymous' : d.donor_name || 'Someone',
        country: d.donor_country || null,
        page: d.pages?.label || d.pages?.title || '',
        pageTitle: d.pages?.title || '',
      })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
