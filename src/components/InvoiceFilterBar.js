'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import DateRangePicker from './DateRangePicker'

const STATUS_OPTIONS = ['all', 'pending', 'completed', 'failed']

export default function InvoiceFilterBar({ pages, fixedPageId, basePath = '/admin', anchor = '#invoices' }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const status = searchParams.get('status') || 'all'
  const pageId = fixedPageId || searchParams.get('page') || 'all'
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  function pushParams(overrides) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(overrides).forEach(([key, value]) => {
      if (!value || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    router.push(`${basePath}?${params.toString()}${anchor}`)
  }

  const fieldStyle = {
    background: 'var(--a-surface-2)',
    borderColor: 'var(--a-border)',
    color: 'var(--a-text)',
  }

  const hasFilters = status !== 'all' || (!fixedPageId && pageId !== 'all') || from || to

  const exportQuery = new URLSearchParams()
  if (status !== 'all') exportQuery.set('status', status)
  if (pageId !== 'all') exportQuery.set('page', pageId)
  if (from) exportQuery.set('from', from)
  if (to) exportQuery.set('to', to)
  const exportQs = exportQuery.toString()
  const csvHref = `/admin/invoices/export${exportQs ? `?${exportQs}` : ''}`
  const pdfHref = `/admin/invoices/export/print${exportQs ? `?${exportQs}` : ''}`

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <select
        value={status}
        onChange={(e) => pushParams({ status: e.target.value })}
        className="text-sm rounded-lg border px-3 py-1.5 focus:outline-none"
        style={fieldStyle}
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>
        ))}
      </select>

      {pages && (
        <select
          value={pageId}
          onChange={(e) => pushParams({ page: e.target.value })}
          className="text-sm rounded-lg border px-3 py-1.5 focus:outline-none"
          style={fieldStyle}
        >
          <option value="all">All pages</option>
          {pages.map((p) => (
            <option key={p.id} value={p.id}>{p.label || p.title}</option>
          ))}
        </select>
      )}

      <DateRangePicker from={from} to={to} onChange={({ from: f, to: t }) => pushParams({ from: f, to: t })} />

      <a
        href={csvHref}
        className="text-sm font-bold rounded-lg border px-3 py-1.5 hover:opacity-80 transition-opacity"
        style={fieldStyle}
      >
        Download CSV
      </a>
      <a
        href={pdfHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-bold rounded-lg border px-3 py-1.5 hover:opacity-80 transition-opacity"
        style={fieldStyle}
      >
        Download PDF
      </a>

      {hasFilters && (
        <button
          onClick={() => router.push(`${basePath}${anchor}`)}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--a-text-muted)' }}
        >
          Clear all
        </button>
      )}
    </div>
  )
}
