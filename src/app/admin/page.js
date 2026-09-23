import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'
import InvoiceFilterBar from '@/components/InvoiceFilterBar'

export default async function AdminPage({ searchParams }) {
  const { status: statusFilter, page: pageFilter, from: fromFilter, to: toFilter, q: searchQuery } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: pages } = await supabase
    .from('pages')
    .select('id, slug, title, label')
    .order('created_at', { ascending: true })

  const { data: donations } = await supabase
    .from('donations')
    .select('invoice_number, donor_name, is_anonymous, amount, currency, gateway, gateway_reference, status, page_id, donor_country, created_at')
    .order('created_at', { ascending: false })

  const pageById = Object.fromEntries((pages || []).map((p) => [p.id, p]))
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

  const byPage = (pages || []).map((p) => {
    const rows = completed.filter((d) => d.page_id === p.id)
    return {
      ...p,
      earning: rows.reduce((sum, d) => sum + Number(d.amount), 0),
      count: rows.length,
    }
  })

  const GATEWAY_LABELS = { paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', stripe: 'Card (Stripe)', bank: 'Bank Transfer' }

  const fromDate = fromFilter ? new Date(`${fromFilter}T00:00:00`) : null
  const toDate = toFilter ? new Date(`${toFilter}T23:59:59`) : null
  const searchNeedle = searchQuery ? searchQuery.trim().toLowerCase() : ''

  const filteredDonations = (donations || []).filter((d) => {
    if (statusFilter !== 'all' && d.status !== (statusFilter || 'completed')) return false
    if (pageFilter && d.page_id !== pageFilter) return false
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

  const theadStyle = { background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }

  function exportQuery(gateway) {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (pageFilter && pageFilter !== 'all') params.set('page', pageFilter)
    if (fromFilter) params.set('from', fromFilter)
    if (toFilter) params.set('to', toFilter)
    if (searchQuery) params.set('q', searchQuery)
    params.set('gateway', gateway)
    return params.toString()
  }

  return (
    <main className="admin-theme min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <p className="a-brand a-gold-text">BlessedHands</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admin — {profile.full_name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--a-text-muted)' }}>All pages, all invoices</p>
          </div>
          <div className="flex items-center gap-5">
            <a
              href="/admin/settings"
              className="text-sm font-bold rounded-lg px-4 py-2 transition-colors"
              style={{ background: 'var(--a-surface-2)', border: '1px solid var(--a-border)', color: 'var(--a-accent-strong)' }}
            >
              Payment Settings
            </a>
            <SignOutButton />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="a-card a-card-hero p-6">
            <p className="text-sm font-semibold" style={{ color: 'var(--a-text-muted)' }}>Total earning</p>
            <p className="a-display a-gold-text text-5xl font-semibold mt-1 tabular-nums">
              ${totalEarning.toFixed(2)}
            </p>
          </div>
          <div className="a-card p-6 sm:col-span-2">
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--a-text-muted)' }}>By gateway</p>
            <div className="flex flex-wrap gap-2">
              {byGateway.map((g) => (
                <a
                  key={g.gateway}
                  href={`#gateway-${g.gateway}`}
                  className="text-sm rounded-lg border px-3 py-1.5 hover:opacity-80 transition-opacity"
                  style={{ borderColor: 'var(--a-border)', background: 'var(--a-surface-2)' }}
                >
                  <span style={{ color: 'var(--a-text-muted)' }}>{g.label}: </span>
                  <span className="font-bold tabular-nums">${g.earning.toFixed(2)}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="a-card overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--a-border)' }}>
            <h2 className="font-bold">By country</h2>
          </div>
          {byCountry.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono completed donation নেই।</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--a-border)' }}>
              {byCountry.map((c) => (
                <div key={c.country} className="flex items-center gap-3 px-6 py-3 text-sm">
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

        <div className="a-card overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--a-border)' }}>
            <h2 className="font-bold">Pages</h2>
          </div>
          {(!pages || pages.length === 0) ? (
            <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Kono page ekhono banano hoyni.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase" style={theadStyle}>
                <tr>
                  <th className="text-left px-6 py-3 font-semibold">Page</th>
                  <th className="text-left px-6 py-3 font-semibold">URL</th>
                  <th className="text-right px-6 py-3 font-semibold">Donations</th>
                  <th className="text-right px-6 py-3 font-semibold">Earning</th>
                  <th className="text-right px-6 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {byPage.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: 'var(--a-border)' }}>
                    <td className="px-6 py-3 font-semibold">{p.label || p.title}</td>
                    <td className="px-6 py-3" style={{ color: 'var(--a-text-muted)' }}>/donate/{p.slug}</td>
                    <td className="px-6 py-3 text-right tabular-nums">{p.count}</td>
                    <td className="px-6 py-3 text-right tabular-nums font-semibold">${p.earning.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap">
                      <a
                        href={`/admin/pages/${p.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border text-xs font-bold px-3.5 py-2 mr-2 hover:opacity-80"
                        style={{ borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
                      >
                        Invoices
                      </a>
                      <a
                        href={`/donate/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg text-xs font-bold px-3.5 py-2 transition-transform hover:-translate-y-0.5"
                        style={{ background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }}
                      >
                        Open
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div id="invoices" className="scroll-mt-4">
          <h2 className="font-bold mb-3">All invoices, by gateway</h2>
          <InvoiceFilterBar pages={pages || []} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {byGateway.map((g) => (
              <div key={g.gateway} id={`gateway-${g.gateway}`} className="a-card overflow-hidden scroll-mt-4">
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
                            {pageById[d.page_id]?.label || pageById[d.page_id]?.title || '—'} · {d.donor_name || '—'}
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
      </div>
    </main>
  )
}
