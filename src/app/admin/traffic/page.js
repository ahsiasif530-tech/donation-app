import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const DAYS = 14
const TIME_ZONE = 'Asia/Dhaka'
const PAGE_SIZE = 1000

// Supabase returns at most 1000 rows per request, so read in pages.
async function fetchAll(query) {
  const rows = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await query().range(from, from + PAGE_SIZE - 1)
    rows.push(...(data || []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

const dayOf = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })

function emptyStats() {
  return { views: 0, visitors: new Set(), clicks: 0, paid: 0, earned: 0 }
}

function percent(part, whole) {
  return whole ? `${((part / whole) * 100).toFixed(1)}%` : '—'
}

function sinceIso() {
  return new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString()
}

// A view without a visitor id (storage blocked) counts as its own visitor.
function addView(stats, visitorId) {
  stats.views += 1
  stats.visitors.add(visitorId || `anon-${stats.views}`)
}

function addDonation(stats, donation) {
  stats.clicks += 1
  if (donation.status === 'completed') {
    stats.paid += 1
    stats.earned += Number(donation.amount)
  }
}

const theadStyle = { background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }
const muted = { color: 'var(--a-text-muted)' }

function StatCells({ s, strong }) {
  const cls = `px-4 py-2.5 text-right tabular-nums${strong ? ' font-bold' : ''}`
  return (
    <>
      <td className={cls}>{s.views}</td>
      <td className={cls}>{s.visitors.size}</td>
      <td className={cls}>{s.clicks}</td>
      <td className={cls}>{s.paid}</td>
      <td className={cls}>${s.earned.toFixed(2)}</td>
      <td className={cls}>{percent(s.clicks, s.visitors.size)}</td>
      <td className={cls}>{percent(s.paid, s.visitors.size)}</td>
    </>
  )
}

function PersonCard({ person }) {
  const dayRows = [...person.days.entries()].sort(([a], [b]) => (a < b ? 1 : -1))
  const sourceRows = [...person.sources.entries()].sort(([, a], [, b]) => b - a)

  return (
    <div className="a-card overflow-x-auto">
      <div className="px-6 py-4 border-b flex flex-wrap items-baseline gap-x-4 gap-y-1" style={{ borderColor: 'var(--a-border)' }}>
        <h2 className="font-bold text-lg">{person.name}</h2>
        <span className="text-sm" style={muted}>/donate/{person.slug}</span>
        <span className="text-sm ml-auto">
          <span style={muted}>{DAYS} days: </span>
          <span className="font-bold tabular-nums">{person.total.views} views · {person.total.clicks} clicks · {person.total.paid} paid · ${person.total.earned.toFixed(2)}</span>
        </span>
      </div>

      {sourceRows.length > 0 && (
        <div className="px-6 py-3 border-b flex flex-wrap gap-2 text-sm" style={{ borderColor: 'var(--a-border)' }}>
          <span style={muted}>Comes from:</span>
          {sourceRows.map(([source, count]) => (
            <span key={source} className="rounded-lg border px-2.5 py-0.5" style={{ borderColor: 'var(--a-border)', background: 'var(--a-surface-2)' }}>
              {source} <span className="font-bold tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}

      {dayRows.length === 0 ? (
        <p className="px-6 py-8 text-sm text-center" style={muted}>Ei {DAYS} dine kono data nei.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase" style={theadStyle}>
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Day</th>
              <th className="text-right px-4 py-3 font-semibold">Views</th>
              <th className="text-right px-4 py-3 font-semibold">Visitors</th>
              <th className="text-right px-4 py-3 font-semibold">Donate clicks</th>
              <th className="text-right px-4 py-3 font-semibold">Paid</th>
              <th className="text-right px-4 py-3 font-semibold">Earned</th>
              <th className="text-right px-4 py-3 font-semibold">Click rate</th>
              <th className="text-right px-4 py-3 font-semibold">Pay rate</th>
            </tr>
          </thead>
          <tbody>
            {dayRows.map(([day, s]) => (
              <tr key={day} className="border-t" style={{ borderColor: 'var(--a-border)' }}>
                <td className="px-4 py-2.5 font-semibold">{day}</td>
                <StatCells s={s} />
              </tr>
            ))}
            <tr className="border-t" style={{ borderColor: 'var(--a-border)', background: 'var(--a-surface-2)' }}>
              <td className="px-4 py-2.5 font-bold">Total</td>
              <StatCells s={person.total} strong />
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}

export default async function AdminTrafficPage() {
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

  const since = sinceIso()

  const { data: pages } = await supabase
    .from('pages')
    .select('id, slug, title, label')
    .order('created_at', { ascending: true })

  const views = await fetchAll(() =>
    supabase.from('page_views').select('page_id, visitor_id, source, created_at').gte('created_at', since).order('created_at')
  )
  const donations = await fetchAll(() =>
    supabase.from('donations').select('page_id, amount, status, created_at').gte('created_at', since).order('created_at')
  )

  // One entry per donation page (one per person): 14-day total, per-day stats, and view sources.
  const people = new Map(
    (pages || []).map((p) => [
      p.id,
      { name: p.label || p.title || p.slug, slug: p.slug, total: emptyStats(), days: new Map(), sources: new Map() },
    ])
  )

  function dayStats(person, iso) {
    const day = dayOf(iso)
    if (!person.days.has(day)) person.days.set(day, emptyStats())
    return person.days.get(day)
  }

  for (const v of views) {
    const person = people.get(v.page_id)
    if (!person) continue
    addView(person.total, v.visitor_id)
    addView(dayStats(person, v.created_at), v.visitor_id)
    person.sources.set(v.source, (person.sources.get(v.source) || 0) + 1)
  }

  for (const d of donations) {
    const person = people.get(d.page_id)
    if (!person) continue
    addDonation(person.total, d)
    addDonation(dayStats(person, d.created_at), d)
  }

  return (
    <main className="admin-theme min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-medium" style={muted}>← Back to admin</Link>
          <h1 className="text-2xl font-bold mt-2">Traffic</h1>
          <p className="text-sm" style={muted}>
            Last {DAYS} days, Bangladesh time. Visitors = unique browsers. Donate clicks = invoices created (your own $1 tests are included).
          </p>
        </div>

        {people.size === 0 ? (
          <p className="text-sm text-center" style={muted}>Kono page ekhono banano hoyni.</p>
        ) : (
          [...people.entries()].map(([id, person]) => <PersonCard key={id} person={person} />)
        )}
      </div>
    </main>
  )
}
