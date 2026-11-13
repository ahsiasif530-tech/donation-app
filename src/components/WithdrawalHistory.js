'use client'

import { useState } from 'react'
import DateRangePicker from './DateRangePicker'



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
// ([{ id, name, person, page }]) then adds one tab per person, and a page
// picker when that person has more than one page.
export default function WithdrawalHistory({ withdrawals: allWithdrawals, pageName, fileName, pages = [] }) {
  // One day of withdrawals at a time, newest day first.
  const [dayIndex, setDayIndex] = useState(0)
  const [selectedPerson, setSelectedPerson] = useState('all')
  const [selectedPageId, setSelectedPageId] = useState('all')
  const [range, setRange] = useState({ from: '', to: '' })
  const personOf = (p) => p.person || p.name
  const people = [...new Set(pages.map(personOf))]
  const personPages = pages.filter((p) => personOf(p) === selectedPerson)
  const personPageIds = new Set(personPages.map((p) => p.id))
  const selectedPage = personPages.find((p) => p.id === selectedPageId)
  // Days are compared in the viewer's local time, matching the times shown.
  const withdrawals = allWithdrawals.filter((w) => {
    if (selectedPerson !== 'all' && !personPageIds.has(w.page_id)) return false
    if (selectedPage && w.page_id !== selectedPage.id) return false
    const day = localDay(new Date(w.created_at))
    if (range.from && day < range.from) return false
    if (range.to && day > range.to) return false
    return true
  })
  const filtered = selectedPerson !== 'all' || range.from
  const exportName = selectedPage ? selectedPage.name : selectedPerson !== 'all' ? selectedPerson : null
  const total = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0)
  const days = []
  for (const w of withdrawals) {
    const key = localDay(new Date(w.created_at))
    if (days.at(-1)?.key !== key) days.push({ key, at: new Date(w.created_at), rows: [] })
    days.at(-1).rows.push(w)
  }
  const day = days[Math.min(dayIndex, days.length - 1)]
  const dayTotal = day ? day.rows.reduce((sum, w) => sum + Number(w.amount), 0) : 0

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
    link.download = `${exportName ? exportName.replace(/[^\w-]+/g, '-') : fileName}-withdrawals-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="a-card a-card-lift overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--a-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black shrink-0" style={{ background: 'linear-gradient(135deg, #F87171, #B91C1C)', color: '#fff' }} aria-hidden="true">↓</span>
          <div className="min-w-0">
            <h3 className="font-bold truncate">Withdrawals</h3>
            <p className="text-[11px]" style={{ color: 'var(--a-text-muted)' }}>
              {withdrawals.length} {withdrawals.length === 1 ? 'withdrawal' : 'withdrawals'} · {days.length} {days.length === 1 ? 'day' : 'days'}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="a-display text-xl font-semibold tabular-nums" style={{ color: 'var(--a-danger)' }}>−${total.toFixed(2)}</p>
          {withdrawals.length > 0 && (
            <button type="button" onClick={downloadExcel} className="a-btn-soft rounded-md border px-2 py-0.5 text-[10px] font-bold mt-1">
              ⬇ Excel
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-b" style={{ borderColor: 'var(--a-border)' }}>
        <DateRangePicker
          from={range.from}
          to={range.to}
          onChange={(next) => {
            setRange(next)
            setDayIndex(0)
          }}
        />
        {people.length > 0 &&
          ['all', ...people].map((person) => (
            <button
              key={person}
              type="button"
              onClick={() => {
                setSelectedPerson(person)
                setSelectedPageId('all')
                setDayIndex(0)
              }}
              className="a-tab rounded-full px-3 py-1 text-xs font-bold"
              aria-pressed={person === selectedPerson}
            >
              {person === 'all' ? 'All' : person}
            </button>
          ))}
        {personPages.length > 1 && (
          <select
            value={selectedPageId}
            onChange={(e) => {
              setSelectedPageId(e.target.value)
              setDayIndex(0)
            }}
            aria-label={`${selectedPerson}'s pages`}
            className="a-row-in rounded-lg border px-2.5 py-1 text-xs font-bold"
            style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
          >
            <option value="all">All {personPages.length} pages</option>
            {personPages.map((p) => (
              <option key={p.id} value={p.id}>{p.page || p.name}</option>
            ))}
          </select>
        )}
      </div>

      {withdrawals.length === 0 ? (
        <div className="px-5 py-10 text-center a-row-in">
          <p className="text-2xl mb-1" aria-hidden="true">🪙</p>
          <p className="text-sm" style={{ color: 'var(--a-text-muted)' }}>
            {filtered ? 'Ei filter e kono withdraw nei.' : 'Ekhono kono withdraw kora hoyni.'}
          </p>
        </div>
      ) : (
        <div key={`${day.key}|${selectedPerson}|${selectedPageId}`}>
          <div className="a-row-in flex items-center justify-between gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--a-border)', background: 'var(--a-surface-2)' }}>
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg" aria-hidden="true">📅</span>
              <div className="min-w-0">
                <p className="text-sm font-bold" suppressHydrationWarning>
                  {day.at.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-[11px]" style={{ color: 'var(--a-text-muted)' }}>
                  {day.rows.length} {day.rows.length === 1 ? 'withdrawal' : 'withdrawals'}
                </p>
              </div>
            </div>
            <p className="text-sm font-bold tabular-nums shrink-0" style={{ color: 'var(--a-danger)' }}>−${dayTotal.toFixed(2)}</p>
          </div>

          <div className="p-2 space-y-1">
            {day.rows.map((w, i) => {
              const at = new Date(w.created_at)
              return (
                <div key={w.id} className="a-row a-row-in flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm" style={{ '--i': i + 1 }}>
                  <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(248,113,113,0.14)', color: 'var(--a-danger)' }} aria-hidden="true">
                    ↓
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{w.page_name || pageName || '—'}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--a-text-muted)' }} suppressHydrationWarning>
                      {[at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }), w.note].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <p className="font-bold tabular-nums shrink-0" style={{ color: 'var(--a-danger)' }}>−${Number(w.amount).toFixed(2)}</p>
                </div>
              )
            })}
          </div>

          {days.length > 1 && (
            <div className="flex items-center justify-between gap-2 border-t px-5 py-3" style={{ borderColor: 'var(--a-border)' }}>
              <button type="button" disabled={dayIndex === 0} onClick={() => setDayIndex((i) => Math.max(0, i - 1))} className="a-btn-soft rounded-lg border px-3.5 py-1.5 text-xs font-bold">
                ‹ Newer
              </button>
              <span className="text-[11px]" style={{ color: 'var(--a-text-muted)' }}>
                Day <b style={{ color: 'var(--a-text)' }}>{Math.min(dayIndex, days.length - 1) + 1}</b> of {days.length}
              </span>
              <button type="button" disabled={dayIndex >= days.length - 1} onClick={() => setDayIndex((i) => Math.min(days.length - 1, i + 1))} className="a-btn-soft rounded-lg border px-3.5 py-1.5 text-xs font-bold">
                Older ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
