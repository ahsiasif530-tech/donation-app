'use client'

import { useState } from 'react'

const PAGE_SIZE = 5

// Rows arrive pre-formatted from the server (subtitle, failureLabel) so the
// client render matches the server HTML regardless of locale/timezone.
export default function AdminInvoiceList({ invoices }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  if (invoices.length === 0) {
    return <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono invoice নেই।</p>
  }

  const hasMore = visibleCount < invoices.length

  return (
    <div>
      <div className="divide-y" style={{ borderColor: 'var(--a-border)' }}>
        {invoices.slice(0, visibleCount).map((d) => (
          <a
            key={d.invoice_number}
            href={`/admin/invoices/${d.invoice_number}`}
            className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:opacity-80"
            style={{ borderColor: 'var(--a-border)' }}
          >
            <div className="min-w-0">
              <p className="font-semibold truncate" style={{ color: 'var(--a-accent-strong)' }}>{d.invoice_number}</p>
              <p className="text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>{d.subtitle}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold tabular-nums">${Number(d.amount).toFixed(2)}</p>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold capitalize"
                style={
                  d.status === 'completed'
                    ? { background: 'rgba(52,211,153,0.14)', color: 'var(--a-success)' }
                    : d.status === 'failed'
                    ? { background: 'rgba(248,113,113,0.14)', color: 'var(--a-danger)' }
                    : { background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }
                }
              >
                {d.status}
              </span>
              {d.failureLabel && (
                <p className="mt-1 text-[11px]" style={{ color: 'var(--a-danger)' }}>{d.failureLabel}</p>
              )}
            </div>
          </a>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center border-t px-5 py-3" style={{ borderColor: 'var(--a-border)' }}>
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="rounded-lg border px-4 py-1.5 text-xs font-bold hover:opacity-80"
            style={{ borderColor: 'var(--a-border)', background: 'var(--a-surface-2)', color: 'var(--a-text)' }}
          >
            Load more ({invoices.length - visibleCount} more)
          </button>
        </div>
      )}
    </div>
  )
}
