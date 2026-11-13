'use client'

import { Fragment, useState } from 'react'
import { initials } from '@/lib/avatar'
import { PAGES_PER_GROUP, SEPARATE_PAGE_SLUGS } from '@/lib/pageDomains'
import GroupPager from './GroupPager'

const money = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const rate = (part, whole) => (whole ? (part / whole) * 100 : 0)
const pct = (n) => `${n.toFixed(1)}%`

const SOURCE_ICON = { facebook: '📘', instagram: '📸', whatsapp: '💬', google: '🔎', direct: '🔗', tiktok: '🎵', youtube: '▶️', messenger: '💬', email: '✉️' }
const sourceIcon = (s) => SOURCE_ICON[Object.keys(SOURCE_ICON).find((k) => s.toLowerCase().includes(k))] || '🌐'

const METRICS = [
  { key: 'visitors', label: 'Visitors', fmt: (n) => n },
  { key: 'views', label: 'Views', fmt: (n) => n },
  { key: 'clicks', label: 'Donate clicks', fmt: (n) => n },
  { key: 'paid', label: 'Paid', fmt: (n) => n },
  { key: 'earned', label: 'Earned', fmt: money },
]

function Change({ now, before, invert = false }) {
  if (!before && !now) return null
  if (!before) return <span className="text-[10px] font-bold rounded px-1.5 py-px" style={{ background: 'rgba(52,211,153,0.14)', color: 'var(--a-success)' }}>New</span>
  const change = ((now - before) / before) * 100
  const up = change >= 0
  const good = invert ? !up : up
  return (
    <span
      className="text-[10px] font-bold rounded px-1.5 py-px tabular-nums"
      style={{ background: good ? 'rgba(52,211,153,0.14)' : 'rgba(248,113,113,0.14)', color: good ? 'var(--a-success)' : 'var(--a-danger)' }}
    >
      {up ? '▲' : '▼'} {Math.abs(Math.round(change))}%
    </span>
  )
}

function Tile({ label, value, now, before, accent }) {
  return (
    <div className={`a-card a-stat ${accent ? 'a-card-hero' : ''}`}>
      <p className="a-stat-label">{label}</p>
      <p className={`a-display text-2xl font-semibold tabular-nums ${accent ? 'a-gold-text' : ''}`}>{value}</p>
      <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--a-text-muted)' }}>
        <Change now={now} before={before} /> vs before
      </p>
    </div>
  )
}

// Visitors → donate clicks → paid, each bar as wide as its share of visitors.
function Funnel({ t }) {
  const steps = [
    { label: 'Visitors', value: t.visitors, of: null },
    { label: 'Donate clicks', value: t.clicks, of: rate(t.clicks, t.visitors) },
    { label: 'Paid', value: t.paid, of: rate(t.paid, t.visitors) },
  ]
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const width = t.visitors ? Math.max(4, (s.value / t.visitors) * 100) : 0
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="font-semibold">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-bold">{s.value}</span>
                {s.of !== null && <span className="ml-2 text-xs" style={{ color: 'var(--a-text-muted)' }}>{pct(s.of)} of visitors</span>}
              </span>
            </div>
            <div className="h-7 rounded-lg overflow-hidden" style={{ background: 'var(--a-surface-2)' }}>
              <div
                className="h-full rounded-lg"
                style={{ width: `${width}%`, background: i === 2 ? 'linear-gradient(90deg, #34D399, #10B981)' : i === 1 ? 'linear-gradient(90deg, var(--a-accent), var(--a-accent-strong))' : 'linear-gradient(90deg, #3987e5, #6da7ec)' }}
              />
            </div>
          </div>
        )
      })}
      <p className="text-xs pt-1" style={{ color: 'var(--a-text-muted)' }}>
        Of those who clicked donate, <span className="font-bold" style={{ color: 'var(--a-text)' }}>{pct(rate(t.paid, t.clicks))}</span> paid.
      </p>
    </div>
  )
}

// One metric per day as bars, with a tooltip of every number for that day.
function DailyChart({ daily }) {
  const [metric, setMetric] = useState('visitors')
  const [hover, setHover] = useState(null)
  const m = METRICS.find((x) => x.key === metric)
  const max = Math.max(1, ...daily.map((d) => d[metric]))
  const W = 640
  const H = 200
  const pad = { l: 8, r: 8, t: 10, b: 24 }
  const bw = (W - pad.l - pad.r) / daily.length
  const labelEvery = Math.ceil(daily.length / 7)

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {METRICS.map((x) => (
          <button
            key={x.key}
            type="button"
            onClick={() => setMetric(x.key)}
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={x.key === metric ? { background: 'var(--a-accent)', color: 'var(--a-accent-ink)' } : { border: '1px solid var(--a-border)', color: 'var(--a-text-muted)' }}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${m.label} per day`}>
          <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--a-border)" />
          {daily.map((d, i) => {
            const h = ((H - pad.t - pad.b) * d[metric]) / max
            const x = pad.l + i * bw + bw * 0.15
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + i * bw} y={0} width={bw} height={H} fill="transparent" />
                <rect
                  x={x}
                  y={H - pad.b - h}
                  width={bw * 0.7}
                  height={Math.max(h, d[metric] ? 2 : 0)}
                  rx="4"
                  fill={hover === i ? 'var(--a-accent-strong)' : 'var(--a-accent)'}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
                {(i % labelEvery === 0 || i === daily.length - 1) && (
                  <text x={x + bw * 0.35} y={H - 6} textAnchor="middle" fontSize="11" fill="var(--a-text-muted)">{d.short}</text>
                )}
              </g>
            )
          })}
        </svg>
        {hover !== null && (
          <div
            className="absolute top-0 pointer-events-none rounded-xl px-3 py-2 text-xs shadow-lg"
            style={{
              background: 'var(--a-surface-2)',
              border: '1px solid var(--a-border)',
              left: `${((pad.l + (hover + 0.5) * bw) / W) * 100}%`,
              transform: `translateX(${hover / daily.length > 0.6 ? 'calc(-100% - 10px)' : '10px'})`,
              minWidth: 160,
            }}
          >
            <p className="font-bold mb-1">{daily[hover].long}</p>
            {METRICS.map((x) => (
              <p key={x.key} className="flex justify-between gap-4">
                <span style={{ color: 'var(--a-text-muted)' }}>{x.label}</span>
                <span className="font-bold tabular-nums">{x.fmt(daily[hover][x.key])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Sources({ sources }) {
  const total = sources.reduce((s, [, n]) => s + n, 0)
  if (!total) return <p className="text-sm" style={{ color: 'var(--a-text-muted)' }}>No visits in this period.</p>
  return (
    <div className="space-y-2.5">
      {sources.slice(0, 8).map(([name, n]) => (
        <div key={name}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="font-semibold truncate">{sourceIcon(name)} {name}</span>
            <span className="tabular-nums shrink-0">
              <span className="font-bold">{n}</span>
              <span className="ml-2 text-xs" style={{ color: 'var(--a-text-muted)' }}>{Math.round(rate(n, total))}%</span>
            </span>
          </div>
          <div className="a-bar"><span style={{ width: `${rate(n, total)}%` }} /></div>
        </div>
      ))}
    </div>
  )
}

function Sparkline({ values, color }) {
  const max = Math.max(1, ...values)
  const w = 80
  const h = 22
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * w},${h - 2 - (v / max) * (h - 4)}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const COLUMNS = [
  { key: 'visitors', label: 'Visitors' },
  { key: 'views', label: 'Views' },
  { key: 'clicks', label: 'Clicks' },
  { key: 'paid', label: 'Paid' },
  { key: 'earned', label: 'Earned' },
  { key: 'clickRate', label: 'Click %' },
  { key: 'payRate', label: 'Pay %' },
]

const withRates = (p) => ({ ...p, clickRate: rate(p.total.clicks, p.total.visitors), payRate: rate(p.total.paid, p.total.visitors) })

// A table of pages; a row opens its daily numbers and sources. Clicking a
// column sorts the rows shown (the groups themselves never change).
function PageRows({ pages }) {
  const [sort, setSort] = useState(null)
  const [open, setOpen] = useState(null)
  const rows = sort
    ? [...pages].sort((a, b) => {
        const av = sort.key in a.total ? a.total[sort.key] : a[sort.key]
        const bv = sort.key in b.total ? b.total[sort.key] : b[sort.key]
        return (av - bv) * sort.dir
      })
    : pages

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase" style={{ background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }}>
          <tr>
            <th className="text-left px-5 py-2.5 font-semibold">Page</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => setSort((s) => (s?.key === c.key ? (s.dir < 0 ? { key: c.key, dir: 1 } : null) : { key: c.key, dir: -1 }))}
                  className="uppercase hover:underline"
                  style={{ color: sort?.key === c.key ? 'var(--a-accent-strong)' : undefined }}
                >
                  {c.label}
                  {sort?.key === c.key ? (sort.dir < 0 ? ' ↓' : ' ↑') : ''}
                </button>
              </th>
            ))}
            <th className="text-right px-5 py-2.5 font-semibold">Trend</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <Fragment key={p.id}>
              <tr className="border-t cursor-pointer" style={{ borderColor: 'var(--a-border)' }} onClick={() => setOpen(open === p.id ? null : p.id)}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="a-avatar" style={{ background: p.color, width: 28, height: 28, borderRadius: 9, fontSize: '0.7rem' }}>{initials(p.person)}</span>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {p.person}
                        {p.host && <span className="font-normal" style={{ color: 'var(--a-text-muted)' }}> · {p.title}</span>}
                      </p>
                      <p className="text-[11px] truncate" style={{ color: 'var(--a-text-muted)' }}>{p.host || `/donate/${p.slug}`}</p>
                    </div>
                    <span className="ml-1 text-xs" style={{ color: 'var(--a-text-muted)' }}>{open === p.id ? '▴' : '▾'}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">{p.total.visitors}</td>
                <td className="px-3 py-3 text-right tabular-nums">{p.total.views}</td>
                <td className="px-3 py-3 text-right tabular-nums">{p.total.clicks}</td>
                <td className="px-3 py-3 text-right tabular-nums">{p.total.paid}</td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {money(p.total.earned)}
                  <div><Change now={p.total.earned} before={p.prev.earned} /></div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{pct(p.clickRate)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{pct(p.payRate)}</td>
                <td className="px-5 py-3 text-right"><Sparkline values={p.daily.map((d) => d.visitors)} color={p.color} /></td>
              </tr>
              {open === p.id && (
                <tr style={{ background: 'var(--a-surface-2)' }}>
                  <td colSpan={9} className="px-5 py-4">
                    {p.sources.length > 0 && (
                      <p className="flex flex-wrap gap-1.5 mb-3 text-xs">
                        <span style={{ color: 'var(--a-text-muted)' }}>Comes from:</span>
                        {p.sources.map(([s, n]) => (
                          <span key={s} className="rounded-full px-2 py-0.5" style={{ border: '1px solid var(--a-border)' }}>
                            {sourceIcon(s)} {s} <b className="tabular-nums">{n}</b>
                          </span>
                        ))}
                      </p>
                    )}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                      {[...p.daily].reverse().filter((d) => d.views || d.clicks).map((d) => (
                        <div key={d.day} className="rounded-xl px-3 py-2 text-xs" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)' }}>
                          <p className="font-bold mb-0.5">{d.long}</p>
                          <p style={{ color: 'var(--a-text-muted)' }}>{d.visitors} visitors · {d.clicks} clicks</p>
                          <p>
                            <b>{d.paid}</b> paid · <b className="tabular-nums">{money(d.earned)}</b>
                          </p>
                        </div>
                      ))}
                      {!p.daily.some((d) => d.views || d.clicks) && <p className="text-xs" style={{ color: 'var(--a-text-muted)' }}>No visits in this period.</p>}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={9} className="px-5 py-8 text-center text-sm" style={{ color: 'var(--a-text-muted)' }}>No pages match.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

// Pages four at a time in the same groups and order as the admin's Pages
// table, with México in its own box below. Choosing a person or typing a
// name shows every matching page at once instead.
function PagesTable({ pages, people }) {
  const [group, setGroup] = useState(0)
  const [person, setPerson] = useState('all')
  const [q, setQ] = useState('')

  const all = pages.map(withRates)
  const main = all.filter((p) => !SEPARATE_PAGE_SLUGS.includes(p.slug))
  const separate = all.filter((p) => SEPARATE_PAGE_SLUGS.includes(p.slug))
  const groups = []
  for (let i = 0; i < main.length; i += PAGES_PER_GROUP) groups.push(main.slice(i, i + PAGES_PER_GROUP))

  const needle = q.trim().toLowerCase()
  const filtering = person !== 'all' || needle
  const shown = filtering
    ? main.filter((p) => (person === 'all' || p.person === person) && (!needle || `${p.person} ${p.title} ${p.slug} ${p.host || ''}`.toLowerCase().includes(needle)))
    : groups[Math.min(group, groups.length - 1)] || []

  return (
    <div className="space-y-4">
      <div className="a-card overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-wrap items-center gap-2" style={{ borderColor: 'var(--a-border)' }}>
          <h2 className="a-section-title mr-2">Pages</h2>
          {['all', ...people.map((x) => x.name).filter((n) => main.some((p) => p.person === n))].map((name) => {
            const on = name === person
            const color = people.find((x) => x.name === name)?.color
            return (
              <button
                key={name}
                type="button"
                onClick={() => setPerson(name)}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={on ? { background: 'var(--a-accent)', color: 'var(--a-accent-ink)' } : { border: '1px solid var(--a-border)', color: 'var(--a-text)' }}
              >
                {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
                {name === 'all' ? 'All' : name}
              </button>
            )
          })}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a page…"
            className="ml-auto text-xs rounded-lg border px-3 py-1.5 w-40 focus:outline-none"
            style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
          />
        </div>
        <PageRows key={filtering ? `f-${person}-${needle}` : `g-${group}`} pages={shown} />
        {filtering ? (
          <p className="px-5 py-2.5 border-t text-xs" style={{ borderColor: 'var(--a-border)', color: 'var(--a-text-muted)' }}>
            {shown.length} matching {shown.length === 1 ? 'page' : 'pages'} ·{' '}
            <button type="button" className="underline" onClick={() => { setPerson('all'); setQ('') }}>back to groups</button>
          </p>
        ) : (
          <GroupPager index={group} count={groups.length} onChange={setGroup} />
        )}
      </div>

      {separate.length > 0 && (
        <div className="a-card overflow-hidden">
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--a-border)' }}>
            <h2 className="a-section-title">México</h2>
          </div>
          <PageRows pages={separate} />
        </div>
      )}
    </div>
  )
}

const MEDALS = ['🥇', '🥈', '🥉']

// Each person's pages added together for the period, ranked by money in,
// with the change against the period before.
function PeopleToday({ pages, people, days }) {
  const sum = (list, key, part) => list.reduce((s, p) => s + p[part][key], 0)
  const rows = people
    .map((person) => {
      const own = pages.filter((p) => p.person === person.name && !SEPARATE_PAGE_SLUGS.includes(p.slug))
      if (own.length === 0) return null
      const t = Object.fromEntries(['visitors', 'views', 'clicks', 'paid', 'earned'].map((k) => [k, sum(own, k, 'total')]))
      const b = Object.fromEntries(['visitors', 'clicks', 'paid', 'earned'].map((k) => [k, sum(own, k, 'prev')]))
      return { ...person, pages: own.length, t, b }
    })
    .filter(Boolean)
    .sort((a, b) => b.t.earned - a.t.earned || b.t.paid - a.t.paid || b.t.visitors - a.t.visitors)

  const when = days === 1 ? 'today' : `last ${days} days`
  const before = days === 1 ? 'yesterday' : 'before'

  return (
    <div>
      <h2 className="a-section-title mb-3">
        Team {when}
        <span className="text-xs font-normal" style={{ color: 'var(--a-text-muted)' }}>· all of each person's pages · vs {before}</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {rows.map((r, i) => (
          <div key={r.name} className={`a-card p-4 ${i === 0 && r.t.earned > 0 ? 'a-card-hero' : ''}`}>
            <div className="flex items-center gap-2.5">
              <span className="a-avatar" style={{ background: r.color }}>{initials(r.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="font-bold truncate">{r.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--a-text-muted)' }}>{r.pages} pages</p>
              </div>
              <span className="text-xl" aria-label={`Rank ${i + 1}`}>{MEDALS[i] || <span className="text-sm font-bold" style={{ color: 'var(--a-text-muted)' }}>#{i + 1}</span>}</span>
            </div>
            <div className="flex items-baseline justify-between mt-3">
              <p className={`a-display text-2xl font-semibold tabular-nums ${i === 0 && r.t.earned > 0 ? 'a-gold-text' : ''}`}>{money(r.t.earned)}</p>
              <Change now={r.t.earned} before={r.b.earned} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[
                ['Visitors', r.t.visitors, r.b.visitors],
                ['Clicks', r.t.clicks, r.b.clicks],
                ['Paid', r.t.paid, r.b.paid],
              ].map(([label, now, was]) => (
                <div key={label} className="rounded-lg py-1.5" style={{ background: 'var(--a-surface-2)' }}>
                  <p className="font-bold tabular-nums">{now}</p>
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--a-text-muted)' }}>{label}</p>
                  <p className="text-[10px] tabular-nums" style={{ color: 'var(--a-text-muted)' }}>{before}: {was}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: 'var(--a-text-muted)' }}>
              Pay rate <b style={{ color: 'var(--a-text)' }}>{pct(rate(r.t.paid, r.t.visitors))}</b>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TrafficDashboard({ data }) {
  const { team, days } = data
  const t = team.total
  const p = team.prev
  const payRate = rate(t.paid, t.visitors)
  const prevPayRate = rate(p.paid, p.visitors)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Traffic</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--a-text-muted)' }}>
            {days === 1 ? "Today, Bangladesh time · compared with yesterday." : `Last ${days} days, Bangladesh time · compared with the ${days} days before.`} Visitors are unique browsers; donate clicks are invoices started.
          </p>
        </div>
        <nav className="a-nav inline-flex" aria-label="Period">
          {data.periods.map((d) => (
            <a key={d} href={`/admin/traffic?days=${d}`} aria-current={d === days ? "page" : undefined}>{d === 1 ? "Today" : `${d} days`}</a>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Tile label="Visitors" value={t.visitors} now={t.visitors} before={p.visitors} />
        <Tile label="Views" value={t.views} now={t.views} before={p.views} />
        <Tile label="Donate clicks" value={t.clicks} now={t.clicks} before={p.clicks} />
        <Tile label="Paid" value={t.paid} now={t.paid} before={p.paid} />
        <Tile label="Earned" value={money(t.earned)} now={t.earned} before={p.earned} accent />
        <Tile label="Pay rate" value={pct(payRate)} now={payRate} before={prevPayRate} />
      </div>

      <PeopleToday pages={data.pages} people={data.people} days={days} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="a-card p-5 lg:col-span-2">
          <h2 className="a-section-title mb-3">{days === 1 ? "Hour by hour" : "Day by day"}</h2>
          <DailyChart daily={team.daily} />
        </div>
        <div className="a-card p-5">
          <h2 className="a-section-title mb-4">Funnel</h2>
          <Funnel t={t} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="a-card p-5">
          <h2 className="a-section-title mb-4">Where visitors come from</h2>
          <Sources sources={team.sources} />
        </div>
        <div className="lg:col-span-2">
          <PagesTable pages={data.pages} people={data.people} />
        </div>
      </div>
    </div>
  )
}
