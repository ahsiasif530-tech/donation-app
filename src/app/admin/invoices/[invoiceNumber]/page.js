import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, getSignedInUser } from '@/lib/supabase/server'
import { statusNote } from '@/lib/invoices'
import { readPaymentSettings } from '@/lib/paymentSettings'
import { findPaypalAccount } from '@/lib/paypalAccounts'
import { browserLabel } from '@/lib/userAgent'
import { COUNTRIES } from '@/lib/countries'
import { HOST_BY_PAGE } from '@/lib/pageDomains'
import PrintButton from '@/components/PrintButton'

export default async function InvoiceDetailPage({ params }) {
  const { invoiceNumber } = await params
  const supabase = await createClient()

  const user = await getSignedInUser(supabase)

  if (!user) redirect('/login')

  const [{ data: profile }, { data: donation }, paymentSettings] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase.from('donations').select('*').eq('invoice_number', decodeURIComponent(invoiceNumber)).single(),
    readPaymentSettings(),
  ])

  if (profile?.role !== 'admin') redirect('/dashboard')
  if (!donation) notFound()

  const { data: page } = await supabase
    .from('pages')
    .select('slug, title, label')
    .eq('id', donation.page_id)
    .single()

  // Which of the saved PayPal accounts this donation was paid into.
  const paypalAccount = donation.paypal_account_id
    ? findPaypalAccount(paymentSettings.paypal, donation.paypal_account_id)
    : null

  const issuedAt = new Date(donation.created_at)
  const statusStyle =
    donation.status === 'completed'
      ? { background: 'rgba(52,211,153,0.15)', color: '#34D399', border: '1px solid rgba(52,211,153,0.4)' }
      : donation.status === 'failed'
      ? { background: 'rgba(248,113,113,0.15)', color: '#FCA5A5', border: '1px solid rgba(248,113,113,0.4)' }
      : { background: 'rgba(255,255,255,0.08)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.2)' }
  const statusIcon = donation.status === 'completed' ? '✓' : donation.status === 'failed' ? '✕' : '•'
  const amount = Number(donation.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const ownHost = HOST_BY_PAGE[page?.slug]
  // The page's own name, when it has one beyond the person's label.
  const pageName = ownHost ? page?.title : null
  const countryCode = flagCode(donation.donor_country)
  const note = statusNote(donation)

  return (
    <main className="admin-theme min-h-screen px-4 py-10 print:bg-white print:min-h-0 print:p-0">
      <div className="max-w-2xl mx-auto space-y-6 print:max-w-none print:space-y-0">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/admin#invoices" className="text-sm font-semibold hover:underline" style={{ color: 'var(--a-text-muted)' }}>← Back to admin</Link>
          <PrintButton />
        </div>

        <article
          className="bg-white text-slate-900 rounded-3xl overflow-hidden shadow-2xl print:shadow-none print:rounded-none"
          style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
        >
          {/* Header band */}
          <header className="relative px-6 sm:px-10 pt-9 pb-8" style={{ background: 'linear-gradient(135deg, #12151C 0%, #1D2230 60%, #2A2416 100%)', color: '#F2F4F7' }}>
            <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: 'linear-gradient(90deg, #A8790A, #E8C875, #A8790A)' }} />
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p
                  className="text-2xl"
                  style={{ fontFamily: "'Fraunces', serif", fontStyle: 'italic', fontWeight: 600, background: 'linear-gradient(135deg, #F2D776, #C9A227)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
                >
                  BlessedHands
                </p>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.35em]" style={{ color: '#98A1B3' }}>Invoice</p>
                <p className="mt-1 text-lg font-semibold tracking-wide tabular-nums select-all">{donation.invoice_number}</p>
              </div>
              <div className="sm:text-right">
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold capitalize" style={statusStyle}>
                  <span aria-hidden="true">{statusIcon}</span>
                  {donation.status}
                </span>
                <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: '#98A1B3' }}>Gift received</p>
                <p className="mt-1 text-4xl font-extrabold tabular-nums" style={{ color: '#F2D776' }}>
                  <span className="text-xl align-top mr-1" style={{ color: '#C9A227' }}>{donation.currency}</span>
                  {amount}
                </p>
                <p className="mt-1 text-xs" style={{ color: '#98A1B3' }} suppressHydrationWarning>
                  {issuedAt.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })} ·{' '}
                  {issuedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </header>

          <div className="px-6 sm:px-10 py-8 space-y-6">
            {/* Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoCard
                icon="user"
                label={
                  <>
                    Gift from{' '}
                    {donation.is_anonymous && <span className="normal-case tracking-normal font-medium text-slate-400">· hidden from public</span>}
                  </>
                }
              >
                <p className="font-semibold text-slate-900">{donation.donor_name || '—'}</p>
                {donation.donor_email && <p className="text-sm text-slate-500 break-all">{donation.donor_email}</p>}
                {donation.donor_phone && <p className="text-sm text-slate-500">{donation.donor_phone}</p>}
                {donation.donor_address && <p className="text-sm text-slate-500">{donation.donor_address}</p>}
                {donation.donor_country && (
                  <p className="text-sm text-slate-500 flex items-center gap-1.5 mt-0.5">
                    {countryCode && (
                      // eslint-disable-next-line @next/next/no-img-element -- tiny flag icon
                      <img src={`https://flagcdn.com/20x15/${countryCode}.png`} alt="" width={16} height={12} className="rounded-[2px]" />
                    )}
                    {countryName(donation.donor_country)}
                  </p>
                )}
              </InfoCard>

              <InfoCard icon="page" label="Page">
                <p className="font-semibold text-slate-900">
                  {page?.label || page?.title || '—'}
                  {pageName && <span className="font-normal text-slate-500"> · {pageName}</span>}
                </p>
                <p className="text-sm text-slate-500 break-all">{ownHost || `/donate/${page?.slug}`}</p>
              </InfoCard>

              <InfoCard icon="card" label="Payment">
                <p className="font-semibold text-slate-900">{GATEWAY_LABELS[donation.gateway] || donation.gateway}</p>
                {donation.gateway_reference && (
                  <p className="text-sm text-slate-500 break-all">
                    Transaction <span className="font-mono text-slate-700 select-all">{donation.gateway_reference}</span>
                  </p>
                )}
                {donation.paypal_account_id && (
                  <p className="text-sm text-slate-500 break-all">
                    Into {paypalAccount ? `${paypalAccount.label}${paypalAccount.email ? ` · ${paypalAccount.email}` : ''}` : 'a removed account'}
                  </p>
                )}
              </InfoCard>

              <InfoCard icon="device" label="Details">
                {donation.user_agent ? (
                  <p className="text-sm text-slate-700" title={donation.user_agent}>{browserLabel(donation.user_agent)}</p>
                ) : (
                  <p className="text-sm text-slate-400">No device recorded</p>
                )}
                {note && (
                  <p className="text-sm break-all mt-0.5" style={{ color: donation.status === 'failed' ? '#B91C1C' : '#475569' }}>
                    {donation.status === 'failed' ? 'Failure reason' : 'Status'}: {note}
                  </p>
                )}
              </InfoCard>
            </div>

            {donation.message && (
              <blockquote className="rounded-2xl px-5 py-4 text-slate-700" style={{ background: '#FBF7EA', borderLeft: '4px solid #C9A227' }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: '#A8790A' }}>Message</p>
                <p className="italic">&ldquo;{donation.message}&rdquo;</p>
              </blockquote>
            )}

            {/* Line item and total */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left font-semibold px-5 py-2.5 text-[11px] uppercase tracking-wider">Description</th>
                    <th className="text-right font-semibold px-5 py-2.5 text-[11px] uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold">Gift</p>
                      <p className="text-xs text-slate-500">{pageName || page?.label || page?.title || 'Donation page'}</p>
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-semibold">
                      {donation.currency} {amount}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200" style={{ background: 'linear-gradient(90deg, #FFFDF5, #FBF3DC)' }}>
                <p className="font-bold uppercase tracking-wider text-xs text-slate-600">Total</p>
                <p className="text-2xl font-extrabold tabular-nums text-slate-900">
                  {donation.currency} {amount}
                </p>
              </div>
            </div>
          </div>

          <footer className="px-6 sm:px-10 py-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <p>
              <span className="font-semibold text-slate-600">Thank you for your kindness.</span> May God bless you.
            </p>
            <p className="tabular-nums">{donation.invoice_number}</p>
          </footer>
        </article>
      </div>
    </main>
  )
}

const GATEWAY_LABELS = { paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', stripe: 'Card (via PayPal)', bank: 'Bank transfer' }

const ICONS = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0',
  page: 'M8 3h8l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 0v4h4',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm0 3h18',
  device: 'M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm4 15h2',
}

function InfoCard({ icon, label, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 p-4">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">
        <span className="inline-flex w-6 h-6 items-center justify-center rounded-lg" style={{ background: '#FBF3DC', color: '#A8790A' }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={ICONS[icon]} />
          </svg>
        </span>
        {label}
      </p>
      {children}
    </section>
  )
}

// donor_country holds a country name, or PayPal's two-letter code.
function flagCode(country) {
  if (!country) return null
  if (/^[A-Z]{2}$/.test(country)) return country.toLowerCase()
  return COUNTRIES.find((c) => c.name === country)?.code.toLowerCase() || null
}

function countryName(country) {
  if (/^[A-Z]{2}$/.test(country)) return COUNTRIES.find((c) => c.code === country)?.name || country
  return country
}
