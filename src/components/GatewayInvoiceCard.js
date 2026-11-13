'use client'

import { useState } from 'react'
import AdminInvoiceList from './AdminInvoiceList'

// A coloured mark per gateway for the card header.
const BRANDS = {
  PayPal: { mark: 'P', bg: 'linear-gradient(135deg, #1A6FE0, #0A3F9C)', fg: '#fff' },
  'Apple Pay': { mark: 'A', bg: 'linear-gradient(135deg, #3A3A3C, #111)', fg: '#fff' },
  'Google Pay': { mark: 'G', bg: 'linear-gradient(135deg, #34A853, #1A73E8)', fg: '#fff' },
  'Card (PayPal)': { mark: '▭', bg: 'linear-gradient(135deg, #8B5CF6, #5B21B6)', fg: '#fff' },
  'Bank Transfer': { mark: '⌂', bg: 'linear-gradient(135deg, #0EA5A4, #0F766E)', fg: '#fff' },
  default: { mark: '$', bg: 'var(--a-surface-2)', fg: 'var(--a-accent-strong)' },
}

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

  const brand = BRANDS[label] || BRANDS.default
  const completedCount = rows.filter((d) => d.status === 'completed').length

  return (
    <div id={id} className={`${className || ''} a-card-lift`} style={style}>
      <div className="px-5 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--a-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shrink-0" style={{ background: brand.bg, color: brand.fg }} aria-hidden="true">
            {brand.mark}
          </span>
          <div className="min-w-0">
            <h3 className="font-bold truncate">{label}</h3>
            <p className="text-[11px]" style={{ color: 'var(--a-text-muted)' }}>
              {rows.length} {rows.length === 1 ? 'invoice' : 'invoices'} · {completedCount} completed
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="a-display a-gold-text text-xl font-semibold tabular-nums">${earning.toFixed(2)}</p>
          <div className="flex items-center justify-end gap-1.5 mt-1">
            <a href={`/admin/invoices/export?${query}`} className="a-btn-soft rounded-md border px-2 py-0.5 text-[10px] font-bold">
              ⬇ CSV
            </a>
            <a href={`/admin/invoices/export/print?${query}`} target="_blank" rel="noopener noreferrer" className="a-btn-soft rounded-md border px-2 py-0.5 text-[10px] font-bold">
              ⬇ PDF
            </a>
          </div>
        </div>
      </div>

      {tabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-3 border-b" style={{ borderColor: 'var(--a-border)' }}>
          {tabs.map((t) => {
            const active = t.id === accountId
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAccountId(t.id)}
                className="a-tab rounded-full px-3 py-1 text-xs font-bold"
                aria-pressed={active}
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
