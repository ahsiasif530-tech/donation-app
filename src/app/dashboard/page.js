import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SignOutButton from '@/components/SignOutButton'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, page_id')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')

  if (!profile?.page_id) {
    return (
      <main className="admin-theme min-h-screen px-4 py-10">
        <div className="max-w-2xl mx-auto a-card p-8 text-center">
          <p style={{ color: 'var(--a-text-muted)' }}>Tomar account-e ekhono kono page assign kora hoyni. Admin-ke bolo.</p>
          <SignOutButton className="mt-4" />
        </div>
      </main>
    )
  }

  const { data: page } = await supabase
    .from('pages')
    .select('id, slug, title, enabled_gateways')
    .eq('id', profile.page_id)
    .single()

  const { data: donations } = await supabase
    .from('donations')
    .select('invoice_number, donor_name, is_anonymous, amount, currency, gateway, status, created_at')
    .eq('page_id', profile.page_id)
    .order('created_at', { ascending: false })

  const completed = (donations || []).filter((d) => d.status === 'completed')
  const totalEarning = completed.reduce((sum, d) => sum + Number(d.amount), 0)

  const GATEWAY_LABELS = { paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', stripe: 'Card (Stripe)', bank: 'Bank Transfer' }
  const byGateway = Object.keys(GATEWAY_LABELS).map((g) => {
    const rows = (donations || []).filter((d) => d.gateway === g)
    return {
      gateway: g,
      label: GATEWAY_LABELS[g],
      earning: rows.filter((d) => d.status === 'completed').reduce((sum, d) => sum + Number(d.amount), 0),
      invoices: rows,
    }
  })

  return (
    <main className="admin-theme min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <p className="a-brand a-gold-text">BlessedHands</p>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Hi, {profile.full_name}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--a-text-muted)' }}>Page: /donate/{page?.slug}</p>
          </div>
          <SignOutButton />
        </div>

        <div className="a-card a-card-hero p-6">
          <p className="text-sm font-semibold" style={{ color: 'var(--a-text-muted)' }}>Total earning (completed)</p>
          <p className="a-display a-gold-text text-5xl font-semibold mt-1 tabular-nums">
            ${totalEarning.toFixed(2)}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {byGateway.map((g) => (
            <div key={g.gateway} className="a-card overflow-hidden">
              <div className="px-5 py-3.5 border-b flex items-center justify-between" style={{ borderColor: 'var(--a-border)' }}>
                <h3 className="font-bold">{g.label}</h3>
                <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>${g.earning.toFixed(2)}</span>
              </div>
              {g.invoices.length === 0 ? (
                <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono invoice নেই।</p>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--a-border)' }}>
                  {g.invoices.map((d) => (
                    <div key={d.invoice_number} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
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
                    </div>
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
