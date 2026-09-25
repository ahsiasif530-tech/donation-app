'use client'

import { useState } from 'react'
import DateRangePicker from './DateRangePicker'

const PAGE_SIZE = 5

function csvEscape(value) {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function localDay(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

// Dates are formatted in the viewer's browser so the time shown (and written
// to the Excel file) is their local time, not the server's. Rows can carry
// their own page_name when the list mixes several pages; passing `pages`
// ([{ id, name }]) then adds a tab per page to show one page at a time.
export default function WithdrawalHistory({ withdrawals: allWithdrawals, pageName, fileName, pages = [] }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [selectedPageId, setSelectedPageId] = useState('all')
  const [range, setRange] = useState({ from: '', to: '' })
  const selectedPage = pages.find((p) => p.id === selectedPageId)
  // Days are compared in the viewer's local time, matching the times shown.
  const withdrawals = allWithdrawals.filter((w) => {
    if (selectedPage && w.page_id !== selectedPage.id) return false
    const day = localDay(new Date(w.created_at))
    if (range.from && day < range.from) return false
    if (range.to && day > range.to) return false
    return true
  })
  const filtered = selectedPage || range.from
  const total = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0)
  const hasMore = visibleCount < withdrawals.length

  function downloadExcel() {
    const headers = ['Date', 'Time', 'Page', 'Amount (USD)', 'Note']
    const rows = withdrawals.map((w) => {
      const at = new Date(w.created_at)
      return [at.toLocaleDateString(), at.toLocaleTimeString(), w.page_name || pageName, Number(w.amount).toFixed(2), w.note || '']
    })
    rows.push(['', '', 'Total', total.toFixed(2), ''])
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n')
    // The BOM makes Excel read the file as UTF-8.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${selectedPage ? selectedPage.name.replace(/[^\w-]+/g, '-') : fileName}-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-2xl border" style={{ background: 'var(--a-surface)', borderColor: 'var(--a-border)' }}>
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

      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b" style={{ borderColor: 'var(--a-border)' }}>
        <DateRangePicker
          from={range.from}
          to={range.to}
          onChange={(next) => {
            setRange(next)
            setVisibleCount(PAGE_SIZE)
          }}
        />
        {pages.length > 0 &&
          [{ id: 'all', name: 'All' }, ...pages].map((p) => {
            const active = p.id === selectedPageId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setSelectedPageId(p.id)
                  setVisibleCount(PAGE_SIZE)
                }}
                className="rounded-lg border px-3 py-1 text-xs font-bold hover:opacity-80"
                style={
                  active
                    ? { background: 'var(--a-accent)', borderColor: 'var(--a-accent)', color: 'var(--a-accent-ink)' }
                    : { background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }
                }
              >
                {p.name}
              </button>
            )
          })}
      </div>

      {withdrawals.length === 0 ? (
        <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>
          {filtered ? 'Ei filter e kono withdraw nei.' : 'Ekhono kono withdraw kora hoyni.'}
        </p>
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
                    <p className="text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>
                      {[w.page_name, w.note].filter(Boolean).join(' · ') || '—'}
                    </p>
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
