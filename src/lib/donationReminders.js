import 'server-only'
import { findPaypalAccount } from '@/lib/paypalAccounts'
import { toCredentials } from '@/lib/paypalDonations'
import { getPaypalOrder } from '@/lib/paypal'

// A donor who left an email but didn't finish paying gets one reminder with a
// link that reopens the same invoice. Sent through Resend; without
// RESEND_API_KEY and REMINDER_FROM_EMAIL set, nothing is sent.
const MIN_AGE_MS = 10 * 60 * 60 * 1000
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 10

// PayPal orders the donor never approved. An approved one is left for the
// admin's PayPal recovery, so no one is asked to pay twice.
const UNPAID_ORDER_STATES = ['CREATED', 'VOIDED', 'RESOURCE_NOT_FOUND']

async function orderIsUnpaid(paypal, donation) {
  if (!donation.paypal_order_id) return true
  const credentials = toCredentials(findPaypalAccount(paypal, donation.paypal_account_id))
  if (!credentials) return false
  try {
    const order = await getPaypalOrder({ ...credentials, orderId: donation.paypal_order_id })
    return UNPAID_ORDER_STATES.includes(order.status)
  } catch (err) {
    // PayPal drops orders nobody approved after a few hours.
    return UNPAID_ORDER_STATES.includes(err?.code)
  }
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

async function sendReminderEmail({ to, name, amount, pageTitle, link }) {
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const amountText = `$${Number(amount).toFixed(2)}`
  const text = [
    greeting,
    '',
    `You started a ${amountText} donation to ${pageTitle}, but the payment wasn't completed, so nothing was charged.`,
    '',
    `If you'd still like to give, you can finish it here: ${link}`,
    '',
    'If you already donated, please ignore this email. God bless you.',
  ].join('\n')
  const html = `<p>${escapeHtml(greeting)}</p>
<p>You started a <strong>${amountText}</strong> donation to ${escapeHtml(pageTitle)}, but the payment wasn't completed, so nothing was charged.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 22px;background:#D4A017;color:#1a1a1a;border-radius:10px;font-weight:bold;text-decoration:none">Finish my donation</a></p>
<p>If you already donated, please ignore this email. God bless you.</p>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.REMINDER_FROM_EMAIL, to, subject: 'Your donation wasn’t completed', text, html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
}

// Runs in the background after a donation page view, so no scheduler is
// needed. Each invoice is claimed (reminder_sent_at set) before its email goes
// out, so two page views running at once can't both send it.
export async function sendDueReminders(supabase, origin) {
  if (!process.env.RESEND_API_KEY || !process.env.REMINDER_FROM_EMAIL) return

  const now = Date.now()
  const { data: due, error } = await supabase
    .from('donations')
    .select('invoice_number, donor_name, donor_email, is_anonymous, amount, paypal_order_id, paypal_account_id, created_at, pages(slug, title)')
    .in('status', ['pending', 'failed'])
    .neq('gateway', 'bank')
    .or('failure_reason.is.null,failure_reason.neq.capture_declined')
    .not('donor_email', 'is', null)
    .is('reminder_sent_at', null)
    .gte('created_at', new Date(now - MAX_AGE_MS).toISOString())
    .lte('created_at', new Date(now - MIN_AGE_MS).toISOString())
    .limit(BATCH_SIZE)
  if (error || !due?.length) return

  const { data: settings } = await supabase.from('settings').select('payment_settings').eq('id', 'global').single()
  const paypal = settings?.payment_settings?.paypal

  for (const donation of due) {
    try {
      // Someone who went on to give with a fresh invoice needs no reminder.
      const { count } = await supabase
        .from('donations')
        .select('id', { count: 'exact', head: true })
        .eq('donor_email', donation.donor_email)
        .eq('status', 'completed')
        .gte('created_at', donation.created_at)
      if (count) {
        await supabase.from('donations').update({ reminder_sent_at: new Date().toISOString() }).eq('invoice_number', donation.invoice_number)
        continue
      }

      if (!(await orderIsUnpaid(paypal, donation))) continue

      const { data: claimed } = await supabase
        .from('donations')
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq('invoice_number', donation.invoice_number)
        .is('reminder_sent_at', null)
        .select('invoice_number')
      if (!claimed?.length) continue

      const slug = donation.pages?.slug
      if (!slug) continue
      await sendReminderEmail({
        to: donation.donor_email,
        name: donation.is_anonymous ? null : donation.donor_name,
        amount: donation.amount,
        pageTitle: donation.pages?.title || 'our mission',
        link: `${origin}/donate/${slug}?resume=${encodeURIComponent(donation.invoice_number)}`,
      })
    } catch (err) {
      console.error('Donation reminder failed for', donation.invoice_number, err?.message || err)
    }
  }
}
