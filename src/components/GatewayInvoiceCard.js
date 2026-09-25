'use client'

import { useState } from 'react'
import AdminInvoiceList from './AdminInvoiceList'

// One gateway's invoices. When `accounts` is given (the PayPal card), a tab per
// saved PayPal account narrows the list, the total and the CSV/PDF exports to
// invoices paid into that account. 'none' collects invoices whose account
// wasn't recorded or has since been removed.
export default function GatewayInvoiceCard({ id, className, style, label, invoices, accounts, exportQuery, listKey }) {
  const [accountId, setAccountId] = useState('all')

  const knownIds = new Set((accounts || []).map((a) => a.id))
  const rows = invoices.filter((d) => {
    if (accountId === 'all') return true
    if (accountId === 'none') return !d.paypal_account_id || !knownIds.has(d.paypal_account_id)
    return d.paypal_account_id === accountId
  })
  const earning = rows.filter((d) => d.status === 'completed').reduce((sum, d) => sum + Number(d.amount), 0)

  const tabs = accounts ? [{ id: 'all', label: 'All' }, ...accounts] : []
  if (accounts && invoices.some((d) => !d.paypal_account_id || !knownIds.has(d.paypal_account_id))) {
    tabs.push({ id: 'none', label: 'Not recorded' })
  }

  const query = accountId === 'all' ? exportQuery : `${exportQuery}&account=${encodeURIComponent(accountId)}`

  return (
    <div id={id} className={className} style={style}>
      <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--a-border)' }}>
        <h3 className="font-bold">{label}</h3>
        <div className="flex items-center gap-3">
          <a
            href={`/admin/invoices/export?${query}`}
            className="text-xs font-bold hover:underline"
            style={{ color: 'var(--a-text-muted)' }}
          >
            CSV
          </a>
          <a
            href={`/admin/invoices/export/print?${query}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold hover:underline"
            style={{ color: 'var(--a-text-muted)' }}
          >
            PDF
          </a>
          <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>${earning.toFixed(2)}</span>
        </div>
      </div>

      {tabs.length > 0 && (
        <div className="flex flex-wrap gap-2 px-5 py-3 border-b" style={{ borderColor: 'var(--a-border)' }}>
          {tabs.map((t) => {
            const active = t.id === accountId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAccountId(t.id)}
                className="rounded-lg border px-3 py-1 text-xs font-bold hover:opacity-80"
                style={
                  active
                    ? { background: 'var(--a-accent)', borderColor: 'var(--a-accent)', color: 'var(--a-accent-ink)' }
                    : { background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }
                }
              >
                {t.label}
              </button>
            )
          })}
        </div>
      )}

      <AdminInvoiceList key={`${listKey}|${accountId}`} invoices={rows} />
    </div>
  )
}
