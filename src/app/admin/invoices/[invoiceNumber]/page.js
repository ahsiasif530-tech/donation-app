import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { failureReasonLabel } from '@/lib/invoices'
import PrintButton from '@/components/PrintButton'

export default async function InvoiceDetailPage({ params }) {
  const { invoiceNumber } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: donation } = await supabase
    .from('donations')
    .select('*')
    .eq('invoice_number', decodeURIComponent(invoiceNumber))
    .single()

  if (!donation) notFound()

  const { data: page } = await supabase
    .from('pages')
    .select('slug, title, label')
    .eq('id', donation.page_id)
    .single()

  const issuedAt = new Date(donation.created_at)

  return (
    <main className="admin-theme min-h-screen px-4 py-10 print:bg-white print:min-h-0 print:p-0">
      <div className="max-w-2xl mx-auto space-y-6 print:max-w-none print:space-y-0">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/admin" className="text-sm font-medium" style={{ color: 'var(--a-text-muted)' }}>← Back to admin</Link>
          <PrintButton />
        </div>

        <div className="bg-white text-slate-900 rounded-2xl border border-slate-200 p-10 print:border-0 print:rounded-none print:p-0">
          <div className="flex items-start justify-between border-b border-slate-200 pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">BlessedHands Invoice</h1>
              <p className="text-sm text-slate-500 mt-1">{donation.invoice_number}</p>
            </div>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize"
              style={
                donation.status === 'completed'
                  ? { background: '#DCFCE7', color: '#166534' }
                  : donation.status === 'failed'
                  ? { background: '#FEE2E2', color: '#991B1B' }
                  : { background: '#F1F5F9', color: '#475569' }
              }
            >
              {donation.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Date issued</p>
              <p className="font-medium">{issuedAt.toLocaleDateString()} · {issuedAt.toLocaleTimeString()}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Campaign / page</p>
              <p className="font-medium">{page?.label || page?.title || '—'}</p>
              <p className="text-sm text-slate-500">/donate/{page?.slug}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">
                Donor {donation.is_anonymous && <span className="normal-case text-slate-400">(hidden from public)</span>}
              </p>
              <p className="font-medium">{donation.donor_name || '—'}</p>
              {donation.donor_email && <p className="text-sm text-slate-500">{donation.donor_email}</p>}
              {donation.donor_phone && <p className="text-sm text-slate-500">{donation.donor_phone}</p>}
              {donation.donor_address && <p className="text-sm text-slate-500">{donation.donor_address}</p>}
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Payment method</p>
              <p className="font-medium capitalize">{donation.gateway}</p>
              {donation.gateway_reference && (
                <p className="text-sm text-slate-500 break-all">Transaction ID: {donation.gateway_reference}</p>
              )}
              {failureReasonLabel(donation) && (
                <p className="text-sm break-all" style={{ color: '#991B1B' }}>Failure reason: {failureReasonLabel(donation)}</p>
              )}
            </div>
          </div>

          {donation.message && (
            <div className="mb-8">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">Message</p>
              <p className="text-sm italic text-slate-600">&ldquo;{donation.message}&rdquo;</p>
            </div>
          )}

          <div className="border-t border-slate-200 pt-6 flex items-center justify-between">
            <p className="font-semibold">Total</p>
            <p className="text-3xl font-extrabold tabular-nums">
              {donation.currency} {Number(donation.amount).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
