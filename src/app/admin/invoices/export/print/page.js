import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchFilteredInvoices, failureReasonLabel } from '@/lib/invoices'
import PrintButton from '@/components/PrintButton'

const GATEWAY_LABELS = { paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', stripe: 'Card (Stripe)', bank: 'Bank Transfer' }

export default async function ExportInvoicesPrintPage({ searchParams }) {
  const { status, page, from, to, gateway, q } = await searchParams
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { invoices } = await fetchFilteredInvoices(supabase, { status, page, from, to, gateway, q })
  const total = invoices.filter((d) => d.status === 'completed').reduce((sum, d) => sum + Number(d.amount), 0)

  return (
    <main className="admin-theme min-h-screen px-4 py-10 print:bg-white print:min-h-0 print:p-0">
      <div className="max-w-4xl mx-auto space-y-6 print:max-w-none print:space-y-0">
        <div className="flex items-center justify-between print:hidden">
          <p className="text-sm" style={{ color: 'var(--a-text-muted)' }}>
            {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
            {gateway && gateway !== 'all' && ` · ${GATEWAY_LABELS[gateway] || gateway}`}
            {from && ` · from ${from}`}
            {to && ` · to ${to}`}
            {q && ` · "${q}"`}
          </p>
          <PrintButton />
        </div>

        <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-10 print:border-0 print:rounded-none print:p-0">
          <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">BlessedHands Invoices</h1>
              <p className="text-sm text-slate-500 mt-1">
                {from || 'All time'}
                {to ? ` – ${to}` : ''}
                {gateway && gateway !== 'all' && ` · ${GATEWAY_LABELS[gateway] || gateway}`}
              </p>
            </div>
            <p className="text-sm font-semibold text-slate-500">{invoices.length} invoices</p>
          </div>

          {invoices.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No invoices match these filters.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400 border-b border-slate-200">
                  <th className="py-2 pr-3 font-semibold">Invoice #</th>
                  <th className="py-2 pr-3 font-semibold">Date &amp; Time</th>
                  <th className="py-2 pr-3 font-semibold">Page</th>
                  <th className="py-2 pr-3 font-semibold">Donor</th>
                  <th className="py-2 pr-3 font-semibold">Country</th>
                  <th className="py-2 pr-3 font-semibold">Gateway</th>
                  <th className="py-2 pr-3 font-semibold">Transaction ID</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pl-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((d) => (
                  <tr key={d.invoice_number} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{d.invoice_number}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {new Date(d.created_at).toLocaleDateString()} · {new Date(d.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2 pr-3">BlessedHands</td>
                    <td className="py-2 pr-3">{d.is_anonymous ? 'Anonymous' : d.donor_name || '—'}</td>
                    <td className="py-2 pr-3">{d.donor_country || '—'}</td>
                    <td className="py-2 pr-3 capitalize">{GATEWAY_LABELS[d.gateway] || d.gateway}</td>
                    <td className="py-2 pr-3 break-all">{d.gateway_reference || '—'}</td>
                    <td className="py-2 pr-3">
                      <span className="capitalize">{d.status}</span>
                      {failureReasonLabel(d) && <span className="block text-xs text-slate-500">{failureReasonLabel(d)}</span>}
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums">
                      {d.currency} {Number(d.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="border-t border-slate-200 pt-6 mt-6 flex items-center justify-between">
            <p className="font-semibold">Total (completed)</p>
            <p className="text-2xl font-extrabold tabular-nums">${total.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </main>
  )
}
