import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { createClient, getSignedInUser } from '@/lib/supabase/server'
import { statusNote, dayStart, dayEnd } from '@/lib/invoices'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { readPaymentSettings } from '@/lib/paymentSettings'
import { getPaypalAccounts, getActivePaypalAccountId } from '@/lib/paypalAccounts'
import SignOutButton from '@/components/SignOutButton'
import InvoiceFilterBar from '@/components/InvoiceFilterBar'
import GatewayInvoiceCard from '@/components/GatewayInvoiceCard'
import WithdrawButton from '@/components/WithdrawButton'
import WithdrawalHistory from '@/components/WithdrawalHistory'
import InvoiceSections from '@/components/InvoiceSections'
import CountryBreakdown from '@/components/CountryBreakdown'
import { parseHiddenSections } from '@/lib/invoiceSections'
import RecoverPaypalButton from '@/components/RecoverPaypalButton'
import { pageUrl, HOST_BY_PAGE } from '@/lib/pageDomains'
import PageGroups from '@/components/PageGroups'

const PAGES_PER_GROUP = 4

// Several pages share a person's name (label), so a page is told apart by
// its own title when it has its own address, otherwise by its link.
function pageShortName(p) {
  return HOST_BY_PAGE[p.slug] ? p.title : `/donate/${p.slug}`
}
function pageFullName(p) {
  const person = p.label || p.title
  return HOST_BY_PAGE[p.slug] ? `${person} · ${p.title}` : person
}
// Pages shown in their own box under the Pages table.
const SEPARATE_PAGE_SLUGS = ['blesshand-mx']

const DAY_MS = 24 * 60 * 60 * 1000

function initials(name) {
  return (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}
function firstName(name) {
  return (name || '').trim().split(/\s+/)[0] || 'Admin'
}
// A steady colour per person, so the same name always gets the same avatar.
function avatarColor(name) {
  let hash = 0
  for (const ch of name || '') hash = (hash * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${hash} 70% 68%)`
}

const ICON_PATHS = {
  wallet: 'M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7Zm0 0V6a2 2 0 0 1 2-2h11M16 13.5h2',
  chart: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18M7 15h4',
  paypal: 'M8 20l1.5-9h5a4 4 0 0 0 0-8H8L5 20h3Zm1.5-9L11 4',
  pages: 'M8 3h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 0v4h4M9 13h6M9 17h6',
  flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6',
}

function Icon({ name, size = 15 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  )
}

function StatCard({ icon, label, value, note }) {
  return (
    <div className="a-card a-stat">
      <p className="a-stat-label"><span className="a-icon"><Icon name={icon} /></span>{label}</p>
      <p className="a-display text-3xl font-semibold tabular-nums">${value.toFixed(2)}</p>
      <p className="text-xs" style={{ color: 'var(--a-text-muted)' }}>{note}</p>
    </div>
  )
}

export default async function AdminPage({ searchParams }) {
  const { status: statusFilter, page: pageFilter, from: fromFilter, to: toFilter, q: searchQuery } = await searchParams
  const supabase = await createClient()

  const user = await getSignedInUser(supabase)

  if (!user) redirect('/login')

  // All reads run at once instead of one after another; the role check still
  // happens before anything is rendered.
  const [{ data: profile }, { data: pages }, { data: donations }, paymentSettings, { data: withdrawals }] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
    supabase.from('pages').select('id, slug, title, label').order('created_at', { ascending: true }),
    fetchAll(() =>
      supabase
        .from('donations')
        .select('invoice_number, donor_name, is_anonymous, amount, currency, gateway, gateway_reference, status, failure_reason, failure_code, checkout_step, paypal_account_id, page_id, donor_country, created_at')
        .order('created_at', { ascending: false })
        .order('id')
    ),
    readPaymentSettings(),
    fetchAll(() =>
      supabase.from('withdrawals').select('id, page_id, amount, note, created_at').order('created_at', { ascending: false }).order('id')
    ),
  ])

  if (profile?.role !== 'admin') redirect('/dashboard')

  const pageById = Object.fromEntries((pages || []).map((p) => [p.id, p]))
  const completed = (donations || []).filter((d) => d.status === 'completed')
  const totalEarning = completed.reduce((sum, d) => sum + Number(d.amount), 0)
  const totalWithdrawn = (withdrawals || []).reduce((sum, w) => sum + Number(w.amount), 0)

  // Completed donations in the last day and week, counted back from now.
  const now = Date.now()
  const since = (ms) => completed.filter((d) => now - new Date(d.created_at).getTime() <= ms)
  const sumOf = (rows) => ({ total: rows.reduce((sum, d) => sum + Number(d.amount), 0), count: rows.length })
  const recent = { day: sumOf(since(DAY_MS)), week: sumOf(since(7 * DAY_MS)) }

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
    const withdrawn = (withdrawals || [])
      .filter((w) => w.page_id === p.id)
      .reduce((sum, w) => sum + Number(w.amount), 0)
    return {
      ...p,
      // What's left after withdrawals.
      earning: rows.reduce((sum, d) => sum + Number(d.amount), 0) - withdrawn,
      withdrawn,
      count: rows.length,
    }
  })

  const GATEWAY_LABELS = { paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', stripe: 'Card (PayPal)', bank: 'Bank Transfer' }

  const fromDate = dayStart(fromFilter)
  const toDate = dayEnd(toFilter)
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

  const totalEarningFiltered = byGateway.reduce((sum, g) => sum + g.earning, 0)

  // Completed money per saved PayPal account (PayPal, card, Apple Pay and Google
  // Pay all go through one). Donations from before accounts were recorded have
  // no paypal_account_id and are totalled separately.
  const paypalSettings = paymentSettings.paypal
  const activePaypalId = getActivePaypalAccountId(paypalSettings)
  const paypalCompleted = filteredDonations.filter((d) => d.status === 'completed' && d.gateway !== 'bank')
  const byPaypalAccount = getPaypalAccounts(paypalSettings).map((a) => ({
    id: a.id,
    label: a.label || 'Untitled account',
    active: a.id === activePaypalId,
    earning: paypalCompleted.filter((d) => d.paypal_account_id === a.id).reduce((sum, d) => sum + Number(d.amount), 0),
  }))
  const paypalAccountTabs = byPaypalAccount.map((a) => ({ id: a.id, label: a.label }))
  const knownAccountIds = new Set(byPaypalAccount.map((a) => a.id))
  const unrecordedEarning = paypalCompleted
    .filter((d) => !d.paypal_account_id || !knownAccountIds.has(d.paypal_account_id))
    .reduce((sum, d) => sum + Number(d.amount), 0)

  // Changing any filter remounts the lists so they start again at 5 rows.
  const listKey = [statusFilter, pageFilter, fromFilter, toFilter, searchQuery].join('|')

  // The invoice boxes, each of which the admin can switch off under "Sections".
  const hiddenSections = parseHiddenSections(await cookies())
  const invoiceSections = [
    ...byGateway.map((g) => ({
      key: g.gateway,
      label: g.label,
      content: (
        <GatewayInvoiceCard
          id={`gateway-${g.gateway}`}
          className="a-card overflow-hidden scroll-mt-4"
          label={g.label}
          exportQuery={exportQuery(g.gateway)}
          listKey={listKey}
          accounts={g.gateway === 'paypal' ? paypalAccountTabs : null}
          invoices={g.invoices.map((d) => ({
            invoice_number: d.invoice_number,
            subtitle: `${pageById[d.page_id]?.label || pageById[d.page_id]?.title || '—'} · ${d.donor_name || '—'}`,
            amount: d.amount,
            status: d.status,
            statusNote: statusNote(d),
            paypal_account_id: d.paypal_account_id,
          }))}
        />
      ),
    })),
    {
      key: 'withdrawals',
      label: 'Withdrawals',
      content: (
        <WithdrawalHistory
          withdrawals={(withdrawals || []).map((w) => ({
            ...w,
            page_name: pageById[w.page_id] ? pageFullName(pageById[w.page_id]) : '—',
          }))}
          fileName="all-pages"
          pages={(pages || []).map((p) => ({ id: p.id, name: pageFullName(p), person: p.label || p.title, page: pageShortName(p) }))}
        />
      ),
    },
  ]

  const theadStyle = { background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }

  // The Pages table shows PAGES_PER_GROUP at a time (see PageGroups); the
  // México page sits in its own box below it.
  const separatePages = byPage.filter((p) => SEPARATE_PAGE_SLUGS.includes(p.slug))
  const mainPages = byPage.filter((p) => !SEPARATE_PAGE_SLUGS.includes(p.slug))
  const pageGroups = []
  for (let i = 0; i < mainPages.length; i += PAGES_PER_GROUP) pageGroups.push(mainPages.slice(i, i + PAGES_PER_GROUP))

  const pagesHead = (
    <thead className="text-xs uppercase" style={theadStyle}>
      <tr>
        <th className="text-left px-6 py-3 font-semibold">Page</th>
        <th className="text-right px-6 py-3 font-semibold">Donations</th>
        <th className="text-right px-6 py-3 font-semibold">Earning</th>
        <th className="text-right px-6 py-3 font-semibold"></th>
      </tr>
    </thead>
  )

  const pageRow = (p) => (
    <tr key={p.id} className="border-t" style={{ borderColor: 'var(--a-border)' }}>
      <td className="px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="a-avatar" style={{ background: avatarColor(p.label || p.title) }}>{initials(p.label || p.title)}</span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold truncate">
              {p.label || p.title}
              {HOST_BY_PAGE[p.slug] && <span className="font-normal" style={{ color: 'var(--a-text-muted)' }}> · {p.title}</span>}
            </p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--a-text-muted)' }}>{HOST_BY_PAGE[p.slug] || `/donate/${p.slug}`}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right tabular-nums text-base">{p.count}</td>
      <td className="px-6 py-4 text-right tabular-nums font-semibold text-base">
        ${p.earning.toFixed(2)}
        {p.withdrawn > 0 && (
          <p className="text-[11px] font-normal" style={{ color: 'var(--a-danger)' }}>−${p.withdrawn.toFixed(2)} withdrawn</p>
        )}
      </td>
      <td className="px-6 py-4 text-right whitespace-nowrap">
        <WithdrawButton pageId={p.id} pageName={p.label || p.title} available={p.earning} />
        <Link
          href={`/admin/pages/${p.id}`}
          className="inline-flex items-center gap-1 rounded-lg border text-xs font-bold px-3.5 py-2 mr-2 hover:opacity-80"
          style={{ borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
        >
          Invoices
        </Link>
        <a
          href={pageUrl(p.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-lg text-xs font-bold px-3.5 py-2 transition-transform hover:-translate-y-0.5"
          style={{ background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }}
        >
          Open ↗
        </a>
      </td>
    </tr>
  )

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
    <main className="admin-theme min-h-screen">
      <header className="a-topbar">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="a-brand-sm a-gold-text">BlessedHands</span>
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest rounded-md px-1.5 py-0.5" style={{ background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }}>Admin</span>
          </div>
          <nav className="a-nav hidden md:inline-flex" aria-label="Admin">
            <Link href="/admin" aria-current="page">Dashboard</Link>
            <Link href="/admin/traffic">Traffic</Link>
            <Link href="/admin/settings">Payment Settings</Link>
          </nav>
          <div className="flex items-center gap-3">
            <span className="a-avatar" style={{ background: 'linear-gradient(135deg, var(--a-accent-strong), var(--a-accent))', width: 32, height: 32, borderRadius: 10 }} title={profile.full_name}>
              {initials(profile.full_name)}
            </span>
            <SignOutButton />
          </div>
        </div>
        <nav className="a-nav flex md:hidden w-fit mx-auto mb-3" aria-label="Admin">
          <Link href="/admin" aria-current="page">Dashboard</Link>
          <Link href="/admin/traffic">Traffic</Link>
          <Link href="/admin/settings">Settings</Link>
        </nav>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Welcome back, {firstName(profile.full_name)}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--a-text-muted)' }}>
              {mainPages.length + separatePages.length} pages · {completed.length} completed donations
            </p>
          </div>
          <a
            href="#invoices"
            className="text-sm font-bold rounded-xl px-4 py-2 hover:opacity-90"
            style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', color: 'var(--a-accent-strong)' }}
          >
            View invoices ↓
          </a>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="a-card a-card-hero a-stat col-span-2 lg:col-span-1">
            <p className="a-stat-label"><span className="a-icon"><Icon name="wallet" /></span>Available</p>
            <p className="a-display a-gold-text text-4xl font-semibold tabular-nums">${(totalEarning - totalWithdrawn).toFixed(2)}</p>
            <p className="text-xs" style={{ color: totalWithdrawn > 0 ? 'var(--a-danger)' : 'var(--a-text-muted)' }}>
              {totalWithdrawn > 0 ? `−$${totalWithdrawn.toFixed(2)} withdrawn` : 'Nothing withdrawn yet'}
            </p>
          </div>
          {/* Every completed donation ever; withdrawals never reduce it. */}
          <StatCard icon="chart" label="Lifetime" value={totalEarning} note={`${completed.length} donations`} />
          <StatCard icon="clock" label="Last 24 hours" value={recent.day.total} note={`${recent.day.count} ${recent.day.count === 1 ? 'donation' : 'donations'}`} />
          <StatCard icon="calendar" label="Last 7 days" value={recent.week.total} note={`${recent.week.count} ${recent.week.count === 1 ? 'donation' : 'donations'}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="a-card p-6">
            <h2 className="a-section-title mb-4"><span className="a-icon"><Icon name="card" /></span>By gateway</h2>
            <div className="space-y-3">
              {byGateway.map((g) => {
                const share = totalEarningFiltered > 0 ? (g.earning / totalEarningFiltered) * 100 : 0
                return (
                  <a key={g.gateway} href={`#gateway-${g.gateway}`} className="block group">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-semibold group-hover:underline">{g.label}</span>
                      <span className="tabular-nums">
                        <span className="font-bold">${g.earning.toFixed(2)}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--a-text-muted)' }}>{Math.round(share)}%</span>
                      </span>
                    </div>
                    <div className="a-bar"><span style={{ width: `${share}%` }} /></div>
                  </a>
                )
              })}
            </div>
          </div>

          <div className="a-card p-6">
            {(byPaypalAccount.length > 0 || unrecordedEarning > 0) ? (
              <>
                <h2 className="a-section-title mb-4"><span className="a-icon"><Icon name="paypal" /></span>By PayPal account</h2>
                <div className="space-y-2">
                  {byPaypalAccount.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm"
                      style={{ background: 'var(--a-surface-2)', border: `1px solid ${a.active ? 'rgba(52,211,153,0.45)' : 'var(--a-border)'}` }}
                      title={a.active ? 'Currently receiving donations' : undefined}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.active ? 'var(--a-success)' : 'var(--a-border)' }} />
                        <span className="font-semibold truncate">{a.label}</span>
                        {a.active && <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--a-success)' }}>Active</span>}
                      </span>
                      <span className="font-bold tabular-nums shrink-0">${a.earning.toFixed(2)}</span>
                    </div>
                  ))}
                  {unrecordedEarning > 0 && (
                    <div
                      className="flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm"
                      style={{ background: 'var(--a-surface-2)', border: '1px dashed var(--a-border)' }}
                      title="Paid before the app started recording which PayPal account received each donation"
                    >
                      <span style={{ color: 'var(--a-text-muted)' }}>Account not recorded</span>
                      <span className="font-bold tabular-nums">${unrecordedEarning.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--a-text-muted)' }}>No PayPal account saved yet.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="a-card overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--a-border)' }}>
              <h2 className="a-section-title"><span className="a-icon"><Icon name="pages" /></span>Pages</h2>
              <span className="text-xs font-semibold" style={{ color: 'var(--a-text-muted)' }}>{mainPages.length} pages</span>
            </div>
            {mainPages.length === 0 ? (
              <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Kono page ekhono banano hoyni.</p>
            ) : (
              <PageGroups head={pagesHead} groups={pageGroups.map((group) => group.map(pageRow))} />
            )}
          </div>

          {separatePages.length > 0 && (
            <div className="a-card overflow-hidden">
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--a-border)' }}>
                <h2 className="a-section-title"><span className="a-icon"><Icon name="flag" /></span>México</h2>
              </div>
              <table className="w-full text-sm">
                {pagesHead}
                <tbody>{separatePages.map(pageRow)}</tbody>
              </table>
            </div>
          )}
          </div>

          <CountryBreakdown byCountry={byCountry} totalEarning={totalEarning} />
        </div>

        <div id="invoices" className="scroll-mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="a-section-title text-lg"><span className="a-icon"><Icon name="receipt" /></span>All invoices, by gateway</h2>
            <RecoverPaypalButton />
          </div>
          <InvoiceFilterBar pages={(pages || []).map((p) => ({ id: p.id, label: pageFullName(p) }))} />
          <InvoiceSections initialHidden={hiddenSections} sections={invoiceSections} />
        </div>
      </div>
    </main>
  )
}
