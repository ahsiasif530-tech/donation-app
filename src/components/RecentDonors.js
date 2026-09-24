'use client'

import { useState } from 'react'

const PAGE_SIZE = 5

// Donors arrive with dateLabel already formatted on the server, so the client
// render matches the server HTML regardless of the viewer's locale/timezone.
export default function RecentDonors({ donors }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  if (donors.length === 0) {
    return (
      <p className="text-center text-sm py-6" style={{ color: 'var(--ink-muted)' }}>
        No donors yet — be the first to support this page.
      </p>
    )
  }

  const visibleDonors = donors.slice(0, visibleCount)
  const hasMore = visibleCount < donors.length

  return (
    <div className="flex flex-col">
      {visibleDonors.map((d, i) => (
        <div
          key={d.id}
          className="grid gap-x-3.5 py-4"
          style={{
            gridTemplateColumns: '44px 1fr auto',
            borderTop: i === 0 ? 'none' : '1px solid var(--border)',
          }}
        >
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center font-semibold"
            style={{ background: 'var(--gold-soft)', color: 'var(--gold)', fontFamily: 'var(--font-display)' }}
          >
            {d.display_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <div className="font-semibold text-sm">{d.display_name}</div>
            <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
              {d.dateLabel}
            </div>
          </div>
          <div className="font-semibold text-sm tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
            ${Number(d.amount).toFixed(2)}
          </div>
          {d.message && (
            <div className="col-span-2 col-start-2 mt-2.5 text-sm italic" style={{ color: 'var(--ink-muted)' }}>
              &ldquo;{d.message}&rdquo;
            </div>
          )}
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          className="mt-3 self-center rounded-full border px-5 py-2 text-sm font-semibold hover:opacity-80"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--heading)' }}
        >
          Load more ({donors.length - visibleCount} more)
        </button>
      )}
    </div>
  )
}
