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

  const pageName = Object.fromEntries((pages || []).map((p) => [p.id, p.label || p.title || p.slug]))

  // day -> { total, byPage: { pageId -> stats } }
  const days = new Map()
  function statsFor(iso, pageId) {
    const day = dayOf(iso)
    if (!days.has(day)) days.set(day, { total: emptyStats(), byPage: new Map() })
    const entry = days.get(day)
    if (!entry.byPage.has(pageId)) entry.byPage.set(pageId, emptyStats())
    return [entry.total, entry.byPage.get(pageId)]
  }

  const sources = new Map()

  for (const v of views) {
    for (const s of statsFor(v.created_at, v.page_id)) {
      s.views += 1
      s.visitors.add(v.visitor_id || `anon-${s.views}`)
    }
    const src = sources.get(v.source) || { source: v.source, views: 0, visitors: new Set() }
    src.views += 1
    src.visitors.add(v.visitor_id || `anon-${src.views}`)
    sources.set(v.source, src)
  }

  for (const d of donations) {
    for (const s of statsFor(d.created_at, d.page_id)) {
      s.clicks += 1
      if (d.status === 'completed') {
        s.paid += 1
        s.earned += Number(d.amount)
      }
    }
  }

  const dayRows = [...days.entries()].sort(([a], [b]) => (a < b ? 1 : -1))
  const sourceRows = [...sources.values()].sort((a, b) => b.views - a.views)
  const totalViews = views.length

  const theadStyle = { background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }
  const muted = { color: 'var(--a-text-muted)' }

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

        <div className="a-card overflow-x-auto">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--a-border)' }}>
            <h2 className="font-bold">By day and page</h2>
          </div>
          {dayRows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center" style={muted}>Ekhono kono data nei.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase" style={theadStyle}>
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Day / page</th>
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
                {dayRows.map(([day, entry]) => (
                  <DayRows key={day} day={day} entry={entry} pageName={pageName} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="a-card overflow-hidden">
          <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--a-border)' }}>
            <h2 className="font-bold">Where visitors come from</h2>
          </div>
          {sourceRows.length === 0 ? (
            <p className="px-6 py-8 text-sm text-center" style={muted}>Ekhono kono view record hoyni.</p>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--a-border)' }}>
              {sourceRows.map((s) => (
                <div key={s.source} className="flex items-center gap-3 px-6 py-3 text-sm">
                  <span className="flex-1 font-semibold">{s.source}</span>
                  <span style={muted}>{s.visitors.size} visitors</span>
                  <span className="font-bold tabular-nums w-16 text-right" style={{ color: 'var(--a-accent-strong)' }}>
                    {percent(s.views, totalViews)}
                  </span>
                  <span className="font-bold tabular-nums w-20 text-right">{s.views} views</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function DayRows({ day, entry, pageName }) {
  const pageRows = [...entry.byPage.entries()].sort(([, a], [, b]) => b.views - a.views || b.clicks - a.clicks)
  return (
    <>
      <tr className="border-t" style={{ borderColor: 'var(--a-border)', background: 'var(--a-surface-2)' }}>
        <td className="px-4 py-2.5 font-bold">{day}</td>
        <StatCells s={entry.total} strong />
      </tr>
      {pageRows.map(([pageId, s]) => (
        <tr key={pageId} className="border-t" style={{ borderColor: 'var(--a-border)' }}>
          <td className="px-4 py-2.5 pl-8" style={{ color: 'var(--a-text-muted)' }}>{pageName[pageId] || '—'}</td>
          <StatCells s={s} />
        </tr>
      ))}
    </>
  )
}
