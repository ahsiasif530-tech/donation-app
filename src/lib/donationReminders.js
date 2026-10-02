import 'server-only'
import { findPaypalAccount } from '@/lib/paypalAccounts'
import { toCredentials } from '@/lib/paypalDonations'
import { getPaypalOrder } from '@/lib/paypal'
import { sendGmail } from '@/lib/gmail'

// A donor who left an email but didn't finish paying gets one reminder with a
// link that reopens the same invoice. Sent from a Gmail account; without
// GMAIL_USER and GMAIL_APP_PASSWORD set, nothing is sent.
const SENDER_NAME = 'Sow a Seed in the Name of Jesus'
const MIN_AGE_MS = 5 * 60 * 1000
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000
const BATCH_SIZE = 10

// PayPal orders the donor never approved. An approved one is left for the
// admin's PayPal recovery, so no one is asked to pay twice.
// A deleted order comes back as INVALID_RESOURCE_ID (the error's detail issue).
const UNPAID_ORDER_STATES = ['CREATED', 'VOIDED', 'RESOURCE_NOT_FOUND', 'INVALID_RESOURCE_ID']

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

async function sendReminderEmail({ to, name, amount, link }) {
  const subject = name ? `${name}, your seed is still waiting 💛` : 'Your seed is still waiting 💛'
  const greeting = name ? `Dear ${name},` : 'Dear friend,'
  const amountText = `$${Number(amount).toFixed(2)}`
  const buttonText = '💛 Complete My Seed of Faith'

  const text = [
    greeting,
    '',
    `Thank you for opening your heart to ${SENDER_NAME}. You began a ${amountText} gift, but the payment didn't go through, so nothing was charged.`,
    '',
    'Sometimes a page closes or the connection drops. It happens to all of us. Your gift is saved just as you left it.',
    '',
    'Somewhere today, a family is praying for a miracle. Your seed could be the answer to their prayer. 🙏',
    '',
    `${buttonText}: ${link}`,
    '',
    'It only takes a moment, and your faith can change a life forever.',
    '',
    'Every seed sown in faith, big or small, brings hope to someone who needs it today. Your kindness truly matters to us.',
    '',
    "If you've already given, thank you from the bottom of our hearts. Please ignore this email.",
    '',
    'With love and gratitude,',
    'God bless you and your family 🙏',
  ].join('\n')

  const p = 'margin:0 0 16px;font-size:16px;line-height:1.6;color:#2b2b2b'
  const html = `<div style="max-width:560px;margin:0 auto;padding:24px;font-family:Georgia,'Times New Roman',serif">
<p style="${p}">${escapeHtml(greeting)}</p>
<p style="${p}">Thank you for opening your heart to <strong>${SENDER_NAME}</strong>. You began a <strong>${amountText}</strong> gift, but the payment didn't go through, so nothing was charged.</p>
<p style="${p}">Sometimes a page closes or the connection drops. It happens to all of us. Your gift is saved just as you left it.</p>
<p style="${p};font-style:italic">Somewhere today, a family is praying for a miracle. Your seed could be the answer to their prayer. 🙏</p>
<p style="margin:24px 0;text-align:center"><a href="${escapeHtml(link)}" style="display:inline-block;padding:16px 28px;background:#D4A017;color:#1a1a1a;border-radius:12px;font-size:18px;font-weight:bold;text-decoration:none;font-family:Arial,sans-serif">${buttonText}</a></p>
<p style="${p};text-align:center;font-style:italic;color:#666">It only takes a moment, and your faith can change a life forever.</p>
<p style="${p}">Every seed sown in faith, big or small, brings hope to someone who needs it today. Your kindness truly matters to us.</p>
<p style="${p}">If you've already given, thank you from the bottom of our hearts. Please ignore this email.</p>
<p style="${p}">With love and gratitude,<br>God bless you and your family 🙏</p>
</div>`

  await sendGmail({
    user: process.env.GMAIL_USER,
    appPassword: process.env.GMAIL_APP_PASSWORD,
    fromName: SENDER_NAME,
    to,
    subject,
    text,
    html,
  })
}

// Runs in the background after a donation page view, so no scheduler is
// needed. Each invoice is claimed (reminder_sent_at set) before its email goes
// out, so two page views running at once can't both send it.
export async function sendDueReminders(supabase, origin) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return

  const now = Date.now()
  const { data: due, error } = await supabase
    .from('donations')
    .select('invoice_number, donor_name, donor_email, is_anonymous, amount, paypal_order_id, paypal_account_id, created_at, pages(slug)')
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
        link: `${origin}/donate/${slug}?resume=${encodeURIComponent(donation.invoice_number)}`,
      })
    } catch (err) {
      console.error('Donation reminder failed for', donation.invoice_number, err?.message || err)
    }
  }
}
