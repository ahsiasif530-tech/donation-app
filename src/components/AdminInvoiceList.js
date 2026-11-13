'use client'

import { useState } from 'react'
import Link from 'next/link'

const PAGE_SIZE = 5

const STATUS = {
  completed: { icon: '✓', bg: 'rgba(52,211,153,0.14)', fg: 'var(--a-success)' },
  failed: { icon: '✕', bg: 'rgba(248,113,113,0.14)', fg: 'var(--a-danger)' },
  pending: { icon: '•', bg: 'var(--a-surface-2)', fg: 'var(--a-text-muted)' },
}

// Rows arrive pre-formatted from the server (subtitle, statusNote) so the
// client render matches the server HTML regardless of locale/timezone. Rows
// slide in one after another, including the ones "Show more" adds.
export default function AdminInvoiceList({ invoices }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [firstNew, setFirstNew] = useState(0)

  if (invoices.length === 0) {
    return (
      <div className="px-5 py-10 text-center a-row-in">
        <p className="text-2xl mb-1" aria-hidden="true">🧾</p>
        <p className="text-sm" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono invoice nei.</p>
      </div>
    )
  }

  const shown = invoices.slice(0, visibleCount)
  const hasMore = visibleCount < invoices.length

  return (
    <div>
      <div className="p-2 space-y-1">
        {shown.map((d, i) => {
          const s = STATUS[d.status] || STATUS.pending
          return (
            <Link
              key={d.invoice_number}
              href={`/admin/invoices/${d.invoice_number}`}
              className="a-row a-row-in group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm"
              style={{ '--i': Math.max(0, i - firstNew) }}
            >
              <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: s.bg, color: s.fg }} aria-hidden="true">
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold truncate tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>{d.invoice_number}</p>
                <p className="text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>{d.subtitle}</p>
                {d.statusNote && (
                  <p className="text-[11px] truncate" style={{ color: d.status === 'failed' ? 'var(--a-danger)' : 'var(--a-text-muted)' }}>{d.statusNote}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold tabular-nums">${Number(d.amount).toFixed(2)}</p>
                <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: s.fg }}>{d.status}</span>
              </div>
              <span className="a-row-arrow text-sm shrink-0" style={{ color: 'var(--a-text-muted)' }} aria-hidden="true">→</span>
            </Link>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-5 py-3" style={{ borderColor: 'var(--a-border)' }}>
        <span className="text-[11px] tabular-nums" style={{ color: 'var(--a-text-muted)' }}>
          {shown.length} of {invoices.length}
        </span>
        {hasMore ? (
          <button
            type="button"
            onClick={() => {
              setFirstNew(visibleCount)
              setVisibleCount((count) => count + PAGE_SIZE)
            }}
            className="a-btn-soft rounded-lg border px-4 py-1.5 text-xs font-bold"
          >
            Show {Math.min(PAGE_SIZE, invoices.length - visibleCount)} more ↓
          </button>
        ) : (
          visibleCount > PAGE_SIZE && (
            <button
              type="button"
              onClick={() => {
                setFirstNew(0)
                setVisibleCount(PAGE_SIZE)
              }}
              className="a-btn-soft rounded-lg border px-4 py-1.5 text-xs font-bold"
            >
              Show less ↑
            </button>
          )
        )}
      </div>
    </div>
  )
}
