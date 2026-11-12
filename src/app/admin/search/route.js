import { adminClientOrResponse } from '@/lib/adminGuard'

export const dynamic = 'force-dynamic'

// Admin search across donations (invoice, donor name or email, transaction
// ID) and pages (person, title, link). The text is cut down to plain
// characters before it goes into the filter, so it can't change the query.
export async function GET(request) {
  const { supabase, response } = await adminClientOrResponse()
  if (response) return response

  const raw = new URL(request.url).searchParams.get('q') || ''
  const q = raw.replace(/[^\p{L}\p{N} @._+-]/gu, '').trim().slice(0, 60)
  if (q.length < 2) return Response.json({ donations: [], pages: [] })

  const like = `%${q}%`
  const [donations, pages] = await Promise.all([
    supabase
      .from('donations')
      .select('invoice_number, amount, currency, donor_name, donor_email, status, created_at, pages(label, title)')
      .or(`invoice_number.ilike.${like},donor_name.ilike.${like},donor_email.ilike.${like},gateway_reference.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('pages')
      .select('id, slug, label, title')
      .or(`label.ilike.${like},title.ilike.${like},slug.ilike.${like}`)
      .limit(5),
  ])

  return Response.json(
    {
      donations: (donations.data || []).map((d) => ({
        invoice: d.invoice_number,
        amount: Number(d.amount),
        currency: d.currency,
        donor: d.donor_name || '—',
        email: d.donor_email || '',
        status: d.status,
        page: d.pages?.label || d.pages?.title || '',
        createdAt: d.created_at,
      })),
      pages: (pages.data || []).map((p) => ({ id: p.id, slug: p.slug, label: p.label || p.title, title: p.title })),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
