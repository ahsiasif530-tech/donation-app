import { redirect } from 'next/navigation'
import { createClient, getSignedInUser } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { HOST_BY_PAGE } from '@/lib/pageDomains'
import { personColor } from '@/lib/avatar'
import AdminTopbar from '@/components/AdminTopbar'
import TrafficDashboard from '@/components/TrafficDashboard'

const PERIODS = [7, 14, 30]
const DEFAULT_DAYS = 14
const TIME_ZONE = 'Asia/Dhaka'
const DAY_MS = 24 * 60 * 60 * 1000

const dayOf = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: TIME_ZONE })

function emptyStats() {
  return { views: 0, visitors: new Set(), clicks: 0, paid: 0, earned: 0 }
}

// A view without a visitor id (storage blocked) counts as its own visitor.
let anonCount = 0
function addView(stats, visitorId) {
  stats.views += 1
  stats.visitors.add(visitorId || `anon-${++anonCount}`)
}

function addDonation(stats, donation) {
  stats.clicks += 1
  if (donation.status === 'completed') {
    stats.paid += 1
    stats.earned += Number(donation.amount)
  }
}

// Sets don't cross to the browser; send the counts.
const plain = (s) => ({ views: s.views, visitors: s.visitors.size, clicks: s.clicks, paid: s.paid, earned: s.earned })

export default async function AdminTrafficPage({ searchParams }) {
  const { days: daysParam } = await searchParams
  const days = PERIODS.includes(Number(daysParam)) ? Number(daysParam) : DEFAULT_DAYS

  const supabase = await createClient()
  const user = await getSignedInUser(supabase)
  if (!user) redirect('/login')

  // Twice the period, so each number can be compared with the one before.
  const now = Date.now()
  const since = new Date(now - 2 * days * DAY_MS).toISOString()

  const [{ data: profile }, { data: pages }, { data: views }, { data: donations }] = await Promise.all([
    supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
    supabase.from('pages').select('id, slug, title, label').order('created_at', { ascending: true }),
    fetchAll(() =>
      supabase.from('page_views').select('page_id, visitor_id, source, created_at').gte('created_at', since).order('created_at').order('id')
    ),
    fetchAll(() =>
      supabase.from('donations').select('page_id, amount, status, created_at').gte('created_at', since).order('created_at').order('id')
    ),
  ])

  if (profile?.role !== 'admin') redirect('/dashboard')

  // The days shown, oldest first, as Bangladesh calendar days.
  const dayKeys = Array.from({ length: days }, (_, i) => dayOf(now - (days - 1 - i) * DAY_MS))
  const firstDay = dayKeys[0]
  const inPeriod = (iso) => dayOf(new Date(iso).getTime()) >= firstDay

  const personOrder = [...new Set((pages || []).map((p) => p.label || p.title))]
  const byPage = new Map(
    (pages || []).map((p) => [
      p.id,
      {
        id: p.id,
        person: p.label || p.title,
        title: p.title,
        slug: p.slug,
        host: HOST_BY_PAGE[p.slug] || null,
        color: personColor(p.label || p.title, personOrder),
        total: emptyStats(),
        prev: emptyStats(),
        daily: new Map(dayKeys.map((d) => [d, emptyStats()])),
        sources: new Map(),
      },
    ])
  )
  const team = { total: emptyStats(), prev: emptyStats(), daily: new Map(dayKeys.map((d) => [d, emptyStats()])), sources: new Map() }

  for (const v of views || []) {
    const page = byPage.get(v.page_id)
    if (!page) continue
    if (!inPeriod(v.created_at)) {
      addView(page.prev, v.visitor_id)
      addView(team.prev, v.visitor_id)
      continue
    }
    const day = dayOf(new Date(v.created_at).getTime())
    const source = v.source || 'direct'
    addView(page.total, v.visitor_id)
    addView(team.total, v.visitor_id)
    if (page.daily.has(day)) addView(page.daily.get(day), v.visitor_id)
    if (team.daily.has(day)) addView(team.daily.get(day), v.visitor_id)
    page.sources.set(source, (page.sources.get(source) || 0) + 1)
    team.sources.set(source, (team.sources.get(source) || 0) + 1)
  }

  for (const d of donations || []) {
    const page = byPage.get(d.page_id)
    if (!page) continue
    if (!inPeriod(d.created_at)) {
      addDonation(page.prev, d)
      addDonation(team.prev, d)
      continue
    }
    const day = dayOf(new Date(d.created_at).getTime())
    addDonation(page.total, d)
    addDonation(team.total, d)
    if (page.daily.has(day)) addDonation(page.daily.get(day), d)
    if (team.daily.has(day)) addDonation(team.daily.get(day), d)
  }

  const sortedSources = (map) => [...map.entries()].sort(([, a], [, b]) => b - a)

  const data = {
    days,
    periods: PERIODS,
    dayKeys,
    people: personOrder.map((name) => ({ name, color: personColor(name, personOrder) })),
    team: {
      total: plain(team.total),
      prev: plain(team.prev),
      daily: dayKeys.map((d) => ({ day: d, ...plain(team.daily.get(d)) })),
      sources: sortedSources(team.sources),
    },
    pages: [...byPage.values()].map((p) => ({
      id: p.id,
      person: p.person,
      title: p.title,
      slug: p.slug,
      host: p.host,
      color: p.color,
      total: plain(p.total),
      prev: plain(p.prev),
      daily: dayKeys.map((d) => ({ day: d, ...plain(p.daily.get(d)) })),
      sources: sortedSources(p.sources),
    })),
  }

  return (
    <main className="admin-theme min-h-screen">
      <AdminTopbar active="traffic" name={profile.full_name} />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <TrafficDashboard data={data} />
      </div>
    </main>
  )
}
