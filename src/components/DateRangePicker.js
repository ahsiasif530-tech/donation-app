'use client'

import { useEffect, useRef, useState } from 'react'

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseISODate(str) {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + i)
    return date
  })
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function DateRangePicker({ from, to, onChange }) {
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => parseISODate(from) || new Date())
  const rootRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fromDate = parseISODate(from)
  const toDate = parseISODate(to)
  const days = buildMonthGrid(viewDate)
  const today = new Date()

  function handleDayClick(day) {
    if (!fromDate || (fromDate && toDate)) {
      onChange({ from: toISODate(day), to: '' })
    } else if (day < fromDate) {
      onChange({ from: toISODate(day), to: toISODate(fromDate) })
    } else {
      onChange({ from: toISODate(fromDate), to: toISODate(day) })
      setOpen(false)
    }
  }

  const label = from && to
    ? `${fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${toDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
    : from
    ? `${fromDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – …`
    : 'All dates'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm rounded-lg border px-3 py-1.5 focus:outline-none"
        style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        {label}
      </button>

      {open && (
        <div
          className="absolute z-10 mt-1 w-72 rounded-lg border shadow-lg p-3"
          style={{ background: 'var(--a-surface)', borderColor: 'var(--a-border)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))} className="px-2 py-1 hover:opacity-70">‹</button>
            <span className="text-sm font-semibold">{viewDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))} className="px-2 py-1 hover:opacity-70">›</button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-xs mb-1" style={{ color: 'var(--a-text-muted)' }}>
            {DAY_LABELS.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const inMonth = day.getMonth() === viewDate.getMonth()
              const isFrom = sameDay(day, fromDate)
              const isTo = sameDay(day, toDate)
              const inRange = fromDate && toDate && day > fromDate && day < toDate
              const isToday = sameDay(day, today)

              let style = { color: inMonth ? 'var(--a-text)' : 'var(--a-text-muted)', opacity: inMonth ? 1 : 0.35 }
              if (isFrom || isTo) style = { background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }
              else if (inRange) style = { background: 'var(--a-surface-2)', color: 'var(--a-text)' }

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className="aspect-square rounded-md text-sm flex items-center justify-center hover:opacity-80"
                  style={{ ...style, outline: isToday ? '1px solid var(--a-accent)' : 'none' }}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: 'var(--a-border)' }}>
            <button
              type="button"
              onClick={() => { onChange({ from: '', to: '' }); setOpen(false) }}
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--a-text-muted)' }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setViewDate(new Date())}
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--a-accent-strong)' }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
