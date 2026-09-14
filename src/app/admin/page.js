import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'

export default async function AdminPage() {
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
    .select('invoice_number, donor_name, is_anonymous, amount, currency, gateway, status, page_id, created_at')
    .order('created_at', { ascending: false })

  const pageById = Object.fromEntries((pages || []).map((p) => [p.id, p]))
  const completed = (donations || []).filter((d) => d.status === 'completed')
  const totalEarning = completed.reduce((sum, d) => sum + Number(d.amount), 0)

  const byPage = (pages || []).map((p) => {
    const rows = completed.filter((d) => d.page_id === p.id)
    return {
      ...p,
      earning: rows.reduce((sum, d) => sum + Number(d.amount), 0),
      count: rows.length,
    }
  })

  const GATEWAY_LABELS = { paypal: 'PayPal', stripe: 'Card (Stripe)', bank: 'Bank Transfer', payoneer: 'Payoneer' }

  const byGateway = Object.keys(GATEWAY_LABELS).map((g) => {
    const rows = (donations || []).filter((d) => d.gateway === g)
    return {
      gateway: g,
      label: GATEWAY_LABELS[g],
      earning: rows.filter((d) => d.status === 'completed').reduce((sum, d) => sum + Number(d.amount), 0),
      invoices: rows,
    }
  })

  const cardStyle = { background: 'var(--a-surface)', borderColor: 'var(--a-border)' }
  const theadStyle = { background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }

  return (
    <main className="admin-theme min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
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
          <div className="rounded-2xl border p-6" style={{ ...cardStyle, borderColor: 'var(--a-accent)', boxShadow: '0 0 0 1px var(--a-accent) inset, 0 12px 30px rgba(212,175,55,0.12)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--a-text-muted)' }}>Total earning</p>
            <p className="text-4xl font-extrabold mt-1 tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>
              ${totalEarning.toFixed(2)}
            </p>
          </div>
          <div className="rounded-2xl border p-6 sm:col-span-2" style={cardStyle}>
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

        <div className="rounded-2xl border overflow-hidden" style={cardStyle}>
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

        <div>
          <h2 className="font-bold mb-3">All invoices, by gateway</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {byGateway.map((g) => (
              <div key={g.gateway} id={`gateway-${g.gateway}`} className="rounded-2xl border overflow-hidden scroll-mt-4" style={cardStyle}>
                <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--a-border)' }}>
                  <h3 className="font-bold">{g.label}</h3>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>${g.earning.toFixed(2)}</span>
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
