import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import InvoiceFilterBar from '@/components/InvoiceFilterBar'

const GATEWAY_LABELS = { paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', stripe: 'Card (Stripe)', bank: 'Bank Transfer' }

export default async function PageInvoicesPage({ params, searchParams }) {
  const { id } = await params
  const { status: statusFilter, from: fromFilter, to: toFilter, q: searchQuery } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: page } = await supabase
    .from('pages')
    .select('id, slug, title, label')
    .eq('id', id)
    .single()

  if (!page) notFound()

  const { data: donations } = await supabase
    .from('donations')
    .select('invoice_number, donor_name, is_anonymous, amount, currency, gateway, gateway_reference, status, donor_country, created_at')
    .eq('page_id', id)
    .order('created_at', { ascending: false })

  const completed = (donations || []).filter((d) => d.status === 'completed')
  const totalEarning = completed.reduce((sum, d) => sum + Number(d.amount), 0)

  const countryTotals = new Map()
  for (const d of completed) {
    const country = d.donor_country || 'Unknown'
    const entry = countryTotals.get(country) || { country, total: 0, count: 0 }
    entry.total += Number(d.amount)
    entry.count += 1
    countryTotals.set(country, entry)
  }
  const byCountry = [...countryTotals.values()].sort((a, b) => b.total - a.total)

  const fromDate = fromFilter ? new Date(`${fromFilter}T00:00:00`) : null
  const toDate = toFilter ? new Date(`${toFilter}T23:59:59`) : null
  const searchNeedle = searchQuery ? searchQuery.trim().toLowerCase() : ''

  const filteredDonations = (donations || []).filter((d) => {
    if (statusFilter && statusFilter !== 'all' && d.status !== statusFilter) return false
    const createdAt = new Date(d.created_at)
    if (fromDate && createdAt < fromDate) return false
    if (toDate && createdAt > toDate) return false
    if (searchNeedle) {
      const haystack = `${d.invoice_number || ''} ${d.gateway_reference || ''}`.toLowerCase()
      if (!haystack.includes(searchNeedle)) return false
    }
    return true
  })

  const byGateway = Object.keys(GATEWAY_LABELS).map((g) => {
    const rows = filteredDonations.filter((d) => d.gateway === g)
    return {
      gateway: g,
      label: GATEWAY_LABELS[g],
      earning: rows.filter((d) => d.status === 'completed').reduce((sum, d) => sum + Number(d.amount), 0),
      invoices: rows,
    }
  })

  const cardStyle = { background: 'var(--a-surface)', borderColor: 'var(--a-border)' }

  function exportQuery(gateway) {
    const params = new URLSearchParams()
    if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
    params.set('page', id)
    if (fromFilter) params.set('from', fromFilter)
    if (toFilter) params.set('to', toFilter)
    if (searchQuery) params.set('q', searchQuery)
    params.set('gateway', gateway)
    return params.toString()
  }

  return (
    <main className="admin-theme min-h-screen px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-medium" style={{ color: 'var(--a-text-muted)' }}>← Back to admin</Link>
          <h1 className="text-2xl font-bold mt-2">{page.label || page.title} — invoices</h1>
          <p className="text-sm" style={{ color: 'var(--a-text-muted)' }}>/donate/{page.slug}</p>
        </div>

        <div className="rounded-2xl border p-6" style={{ ...cardStyle, borderColor: 'var(--a-accent)', boxShadow: '0 0 0 1px var(--a-accent) inset, 0 12px 30px rgba(212,175,55,0.12)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--a-text-muted)' }}>Total earning (completed)</p>
          <p className="text-4xl font-extrabold mt-1 tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>
            ${totalEarning.toFixed(2)}
          </p>
        </div>

        <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
          <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--a-border)' }}>
            <h3 className="font-bold">By country</h3>
          </div>
          {byCountry.length === 0 ? (
            <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono completed donation নেই।</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--a-border)' }}>
              {byCountry.map((c) => (
                <div key={c.country} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="flex-1 font-semibold">{c.country}</span>
                  <span style={{ color: 'var(--a-text-muted)' }}>{c.count} {c.count === 1 ? 'donor' : 'donors'}</span>
                  <span className="font-bold tabular-nums w-16 text-right" style={{ color: 'var(--a-accent-strong)' }}>
                    {((c.total / totalEarning) * 100).toFixed(0)}%
                  </span>
                  <span className="font-bold tabular-nums w-20 text-right">${c.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div id="invoices" className="scroll-mt-4">
          <InvoiceFilterBar fixedPageId={id} basePath={`/admin/pages/${id}`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {byGateway.map((g) => (
            <div key={g.gateway} className="rounded-2xl border overflow-hidden" style={cardStyle}>
              <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--a-border)' }}>
                <h3 className="font-bold">{g.label}</h3>
                <div className="flex items-center gap-3">
                  <a
                    href={`/admin/invoices/export?${exportQuery(g.gateway)}`}
                    className="text-xs font-bold hover:underline"
                    style={{ color: 'var(--a-text-muted)' }}
                  >
                    CSV
                  </a>
                  <a
                    href={`/admin/invoices/export/print?${exportQuery(g.gateway)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold hover:underline"
                    style={{ color: 'var(--a-text-muted)' }}
                  >
                    PDF
                  </a>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>${g.earning.toFixed(2)}</span>
                </div>
              </div>
              {g.invoices.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono invoice নেই।</p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--a-border)' }}>
                  {g.invoices.map((d) => (
                    <a
                      key={d.invoice_number}
                      href={`/admin/invoices/${d.invoice_number}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:opacity-80"
                      style={{ borderColor: 'var(--a-border)' }}
                    >
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{ color: 'var(--a-accent-strong)' }}>{d.invoice_number}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>
                          {d.donor_name || '—'} · {new Date(d.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold tabular-nums">${Number(d.amount).toFixed(2)}</p>
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold capitalize"
                          style={
                            d.status === 'completed'
                              ? { background: 'rgba(52,211,153,0.14)', color: 'var(--a-success)' }
                              : d.status === 'failed'
                              ? { background: 'rgba(248,113,113,0.14)', color: 'var(--a-danger)' }
                              : { background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }
                          }
                        >
                          {d.status}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
