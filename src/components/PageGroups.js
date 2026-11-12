'use client'

import { useState } from 'react'

// The admin's pages table, shown a few rows at a time: "Load more" swaps in
// the next group (the earlier one is hidden), and after the last group the
// button goes back to the first. groups is an array of arrays of <tr> rows.
export default function PageGroups({ groups, head }) {
  const [index, setIndex] = useState(0)
  const last = groups.length - 1
  const current = groups[Math.min(index, last)] || []

  return (
    <>
      <table className="w-full text-sm">
        {head}
        <tbody>{current}</tbody>
      </table>
      {groups.length > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t" style={{ borderColor: 'var(--a-border)' }}>
          <span className="text-xs" style={{ color: 'var(--a-text-muted)' }}>
            {index + 1} / {groups.length}
          </span>
          <button
            type="button"
            onClick={() => setIndex(index >= last ? 0 : index + 1)}
            className="rounded-lg border text-xs font-bold px-4 py-2 hover:opacity-80"
            style={{ borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
          >
            {index >= last ? 'Back to first' : 'Load more'}
          </button>
        </div>
      )}
    </>
  )
}
