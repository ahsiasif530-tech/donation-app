'use client'

import { useState } from 'react'
import { initials } from '@/lib/avatar'

const PERIODS = [
  { key: 'week', label: '7 days', compare: 'previous 7 days' },
  { key: 'month', label: '30 days', compare: 'previous 30 days' },
  { key: 'all', label: 'All time', compare: null },
]

const MEDALS = ['🥇', '🥈', '🥉']

const money = (n) => `$${n.toFixed(2)}`
const shortMoney = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`)

// Growth against the period before, e.g. this week against last week.
function Growth({ now, before }) {
  if (before === 0 && now === 0) return null
  if (before === 0) {
    return <span className="text-[10px] font-bold rounded px-1 py-px" style={{ background: 'rgba(52,211,153,0.14)', color: 'var(--a-success)' }}>New ▲</span>
  }
  const change = ((now - before) / before) * 100
  const up = change >= 0
  return (
    <span
      className="text-[10px] font-bold rounded px-1 py-px tabular-nums"
      style={{ background: up ? 'rgba(52,211,153,0.14)' : 'rgba(248,113,113,0.14)', color: up ? 'var(--a-success)' : 'var(--a-danger)' }}
      title={`${money(before)} in the period before`}
    >
      {up ? '▲' : '▼'} {Math.abs(Math.round(change))}%
    </span>
  )
}

// Running total per person across the period, so whoever is ahead sits on
// top and the gaps between lines are the gaps between people.
// chart: { labels: [...], values: { [name]: [amount per bucket] } }
function RaceChart({ chart, people }) {
  const [hover, setHover] = useState(null)
  const W = 560
  const H = 240
  const pad = { l: 44, r: 12, t: 12, b: 26 }
  const n = chart.labels.length
  const running = Object.fromEntries(
    people.map((p) => {
      let sum = 0
      return [p.name, (chart.values[p.name] || []).map((v) => (sum += v))]
    })
  )
  const max = Math.max(1, ...people.map((p) => running[p.name].at(-1) || 0))
  const niceMax = (() => {
    const step = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / step) * step
  })()
  const x = (i) => pad.l + (n <= 1 ? 0 : (i / (n - 1)) * (W - pad.l - pad.r))
  const y = (v) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b)
  const ticks = [0, 0.5, 1].map((f) => f * niceMax)
  const labelEvery = Math.ceil(n / 6)
  const hoverRows = hover === null ? [] : [...people].map((p) => ({ ...p, v: running[p.name][hover] || 0 })).sort((a, b) => b.v - a.v)

  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Running total per person over the period">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--a-border)" strokeWidth="1" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--a-text-muted)">{shortMoney(t)}</text>
          </g>
        ))}
        {chart.labels.map((label, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--a-text-muted)">{label}</text>
          ) : null
        )}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--a-text-muted)" strokeWidth="1" opacity="0.5" />}
        {people.map((p) => (
          <polyline
            key={p.name}
            points={running[p.name].map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={p.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {hover !== null &&
          people.map((p) => (
            <circle key={p.name} cx={x(hover)} cy={y(running[p.name][hover] || 0)} r="4" fill={p.color} stroke="var(--a-surface)" strokeWidth="2" />
          ))}
        {chart.labels.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (W - pad.l - pad.r) / Math.max(1, n - 1) / 2}
            y={0}
            width={(W - pad.l - pad.r) / Math.max(1, n - 1)}
            height={H}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onTouchStart={() => setHover(i)}
          />
        ))}
      </svg>

      {hover !== null && (
        <div
          className="absolute top-2 pointer-events-none rounded-xl px-3 py-2 text-xs shadow-lg"
          style={{
            background: 'var(--a-surface-2)',
            border: '1px solid var(--a-border)',
            left: `${(x(hover) / W) * 100}%`,
            transform: `translateX(${x(hover) / W > 0.6 ? 'calc(-100% - 10px)' : '10px'})`,
            minWidth: 150,
          }}
        >
          <p className="font-bold mb-1">{chart.labels[hover]}</p>
          {hoverRows.map((p) => (
            <p key={p.name} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                {p.name}
              </span>
              <span className="font-bold tabular-nums">{money(p.v)}</span>
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: 'var(--a-text-muted)' }}>
        {people.map((p) => (
          <span key={p.name} className="flex items-center gap-1.5">
            <span className="w-3 h-[2px] rounded" style={{ background: p.color }} />
            {p.name}
          </span>
        ))}
      </div>
    </div>
  )
}

// Who is ahead and by how much, per person (all of a person's pages
// together), beside a chart of the same race over time.
// people: [{ name, color, pages, week: { total, count, prev }, month: {…}, all: { total, count } }]
// charts: { week, month, all } in RaceChart's shape.
export default function TeamProgress({ people, charts }) {
  const [period, setPeriod] = useState('week')
  const current = PERIODS.find((p) => p.key === period)
  const ranked = [...people].sort((a, b) => b[period].total - a[period].total || b[period].count - a[period].count)
  const leader = ranked[0]?.[period].total || 0
  const teamTotal = ranked.reduce((sum, p) => sum + p[period].total, 0)
  const teamBefore = current.compare ? ranked.reduce((sum, p) => sum + p[period].prev, 0) : 0

  return (
    <div className="a-card overflow-hidden">
      <div className="px-5 py-3.5 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--a-border)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="a-section-title">
            <span className="a-icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
              </svg>
            </span>
            Team progress
          </h2>
          <span className="text-xs" style={{ color: 'var(--a-text-muted)' }}>
            Team <span className="font-bold" style={{ color: 'var(--a-text)' }}>{money(teamTotal)}</span>
            {current.compare && <> <Growth now={teamTotal} before={teamBefore} /></>}
          </span>
        </div>
        <div className="a-nav inline-flex" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <a
              key={p.key}
              href="#team-progress"
              role="tab"
              aria-selected={p.key === period}
              aria-current={p.key === period ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                setPeriod(p.key)
              }}
            >
              {p.label}
            </a>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2">
        <ol className="divide-y lg:border-r" style={{ borderColor: 'var(--a-border)' }}>
          {ranked.map((p, i) => {
            const stats = p[period]
            const share = leader > 0 ? (stats.total / leader) * 100 : 0
            return (
              <li key={p.name} className="px-5 py-2.5" style={{ borderColor: 'var(--a-border)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="w-6 text-center shrink-0" aria-label={`Rank ${i + 1}`}>
                    {MEDALS[i] || <span className="text-xs font-bold" style={{ color: 'var(--a-text-muted)' }}>#{i + 1}</span>}
                  </span>
                  <span className="a-avatar" style={{ background: p.color, width: 28, height: 28, borderRadius: 9, fontSize: '0.7rem' }}>{initials(p.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">
                        {p.name}
                        <span className="ml-1.5 text-[11px] font-normal" style={{ color: 'var(--a-text-muted)' }}>{stats.count} don.</span>
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {current.compare && <Growth now={stats.total} before={stats.prev} />}
                        <span className="text-sm font-bold tabular-nums">{money(stats.total)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="a-bar flex-1" style={{ height: 4 }}><span style={{ width: `${share}%`, background: p.color }} /></div>
                      <span className="text-[10px] tabular-nums shrink-0 w-20 text-right" style={{ color: i === 0 ? 'var(--a-accent-strong)' : 'var(--a-text-muted)' }}>
                        {i === 0 ? (stats.total > 0 ? 'Leading' : '—') : `−${money(leader - stats.total)}`}
                      </span>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="p-4">
          <RaceChart chart={charts[period]} people={people} />
        </div>
      </div>
    </div>
  )
}
