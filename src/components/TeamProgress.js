'use client'

import { useState } from 'react'
import { initials, avatarColor } from '@/lib/avatar'

const PERIODS = [
  { key: 'week', label: '7 days', compare: 'previous 7 days' },
  { key: 'month', label: '30 days', compare: 'previous 30 days' },
  { key: 'all', label: 'All time', compare: null },
]

const MEDALS = ['🥇', '🥈', '🥉']

const money = (n) => `$${n.toFixed(2)}`

// Growth against the period before, e.g. this week against last week.
function Growth({ now, before }) {
  if (before === 0 && now === 0) return <span className="text-xs" style={{ color: 'var(--a-text-muted)' }}>—</span>
  if (before === 0) {
    return <span className="text-xs font-bold rounded-md px-1.5 py-0.5" style={{ background: 'rgba(52,211,153,0.14)', color: 'var(--a-success)' }}>New ▲</span>
  }
  const change = ((now - before) / before) * 100
  const up = change >= 0
  return (
    <span
      className="text-xs font-bold rounded-md px-1.5 py-0.5 tabular-nums"
      style={{ background: up ? 'rgba(52,211,153,0.14)' : 'rgba(248,113,113,0.14)', color: up ? 'var(--a-success)' : 'var(--a-danger)' }}
      title={`${money(before)} in the period before`}
    >
      {up ? '▲' : '▼'} {Math.abs(Math.round(change))}%
    </span>
  )
}

// Who is ahead and by how much, per person (all of a person's pages together).
// people: [{ name, pages, week: { total, count, prev }, month: {…}, all: { total, count } }]
export default function TeamProgress({ people }) {
  const [period, setPeriod] = useState('week')
  const current = PERIODS.find((p) => p.key === period)
  const ranked = [...people].sort((a, b) => b[period].total - a[period].total || b[period].count - a[period].count)
  const leader = ranked[0]?.[period].total || 0
  const teamTotal = ranked.reduce((sum, p) => sum + p[period].total, 0)
  const teamBefore = current.compare ? ranked.reduce((sum, p) => sum + p[period].prev, 0) : 0

  return (
    <div className="a-card overflow-hidden">
      <div className="px-6 py-4 border-b flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--a-border)' }}>
        <div>
          <h2 className="a-section-title">
            <span className="a-icon">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />
              </svg>
            </span>
            Team progress
          </h2>
          <p className="text-xs mt-1" style={{ color: 'var(--a-text-muted)' }}>
            Team: <span className="font-bold" style={{ color: 'var(--a-text)' }}>{money(teamTotal)}</span>
            {current.compare && (
              <>
                {' '}· vs {current.compare} <Growth now={teamTotal} before={teamBefore} />
              </>
            )}
          </p>
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

      {ranked.length === 0 ? (
        <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Kono page nei.</p>
      ) : (
        <ol className="divide-y" style={{ borderColor: 'var(--a-border)' }}>
          {ranked.map((p, i) => {
            const stats = p[period]
            const share = leader > 0 ? (stats.total / leader) * 100 : 0
            const behindLeader = leader - stats.total
            const above = ranked[i - 1]?.[period].total
            const behindNext = above !== undefined ? above - stats.total : 0
            return (
              <li key={p.name} className="px-6 py-4" style={{ borderColor: 'var(--a-border)' }}>
                <div className="flex items-center gap-3">
                  <span className="w-7 text-center text-lg shrink-0" aria-label={`Rank ${i + 1}`}>
                    {MEDALS[i] || <span className="text-sm font-bold" style={{ color: 'var(--a-text-muted)' }}>#{i + 1}</span>}
                  </span>
                  <span className="a-avatar" style={{ background: avatarColor(p.name) }}>{initials(p.name)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold truncate">
                        {p.name}
                        <span className="ml-2 text-xs font-normal" style={{ color: 'var(--a-text-muted)' }}>
                          {p.pages} {p.pages === 1 ? 'page' : 'pages'} · {stats.count} {stats.count === 1 ? 'donation' : 'donations'}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 shrink-0">
                        {current.compare && <Growth now={stats.total} before={stats.prev} />}
                        <span className="font-bold tabular-nums">{money(stats.total)}</span>
                      </div>
                    </div>
                    <div className="a-bar mt-2"><span style={{ width: `${share}%` }} /></div>
                    <p className="text-xs mt-1.5" style={{ color: 'var(--a-text-muted)' }}>
                      {i === 0 ? (
                        stats.total > 0 ? <span style={{ color: 'var(--a-accent-strong)' }}>Leading the team</span> : 'No donations in this period'
                      ) : (
                        <>
                          <span style={{ color: 'var(--a-danger)' }}>{money(behindLeader)}</span> behind #1
                          {i > 1 && behindNext > 0 && <> · {money(behindNext)} behind #{i}</>}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
