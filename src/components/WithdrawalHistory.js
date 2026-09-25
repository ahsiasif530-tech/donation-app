'use client'

import { useState } from 'react'

const PAGE_SIZE = 5

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

// Dates are formatted in the viewer's browser so the time shown (and written
// to the Excel file) is their local time, not the server's.
export default function WithdrawalHistory({ withdrawals, pageName, fileName }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const total = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0)
  const hasMore = visibleCount < withdrawals.length

  function downloadExcel() {
    const headers = ['Date', 'Time', 'Page', 'Amount (USD)', 'Note']
    const rows = withdrawals.map((w) => {
      const at = new Date(w.created_at)
      return [at.toLocaleDateString(), at.toLocaleTimeString(), pageName, Number(w.amount).toFixed(2), w.note || '']
    })
    rows.push(['', '', 'Total', total.toFixed(2), ''])
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
    // The BOM makes Excel read the file as UTF-8.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--a-surface)', borderColor: 'var(--a-border)' }}>
      <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--a-border)' }}>
        <h3 className="font-bold">Withdrawals</h3>
        <div className="flex items-center gap-3">
          {withdrawals.length > 0 && (
            <button
              type="button"
              onClick={downloadExcel}
              className="text-xs font-bold hover:underline"
              style={{ color: 'var(--a-text-muted)' }}
            >
              Excel
            </button>
          )}
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--a-danger)' }}>−${total.toFixed(2)}</span>
        </div>
      </div>

      {withdrawals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono withdraw kora hoyni.</p>
      ) : (
        <div>
          <div className="divide-y" style={{ borderColor: 'var(--a-border)' }}>
            {withdrawals.slice(0, visibleCount).map((w) => {
              const at = new Date(w.created_at)
              return (
                <div key={w.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold" suppressHydrationWarning>
                      {at.toLocaleDateString()} · {at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>{w.note || '—'}</p>
                  </div>
                  <p className="font-bold tabular-nums shrink-0" style={{ color: 'var(--a-danger)' }}>−${Number(w.amount).toFixed(2)}</p>
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div className="flex justify-center border-t px-5 py-3" style={{ borderColor: 'var(--a-border)' }}>
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                className="rounded-lg border px-4 py-1.5 text-xs font-bold hover:opacity-80"
                style={{ borderColor: 'var(--a-border)', background: 'var(--a-surface-2)', color: 'var(--a-text)' }}
              >
                Load more ({withdrawals.length - visibleCount} more)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
