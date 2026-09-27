'use client'

import { useState } from 'react'

const PAGE_SIZE = 5

// Traffic table rows, newest day first: only today's row shows at first, and
// Load more reveals earlier days a few at a time. `rows` are the server-rendered
// <tr> elements; `hasToday` says whether the first one is today.
export default function TrafficDayRows({ rows, hasToday }) {
  const [visibleCount, setVisibleCount] = useState(hasToday ? 1 : 0)
  const hasMore = visibleCount < rows.length
  const cellBorder = { borderColor: 'var(--a-border)' }

  return (
    <>
      {!hasToday && (
        <tr className="border-t" style={cellBorder}>
          <td colSpan={8} className="px-4 py-2.5 text-center" style={{ color: 'var(--a-text-muted)' }}>
            Aaj ekhono kono data nei.
          </td>
        </tr>
      )}
      {rows.slice(0, visibleCount)}
      {hasMore && (
        <tr className="border-t" style={cellBorder}>
          <td colSpan={8} className="px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="rounded-lg border px-4 py-1.5 text-xs font-bold hover:opacity-80"
              style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
            >
              Load more
            </button>
          </td>
        </tr>
      )}
    </>
  )
}
