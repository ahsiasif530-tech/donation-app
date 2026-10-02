'use server'

import { headers } from 'next/headers'
import { after } from 'next/server'
import { sendDueReminders } from '@/lib/donationReminders'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPaypalOrder, capturePaypalOrder, getPaypalOrder } from '@/lib/paypal'
import { getPaypalAccounts, getActivePaypalAccount, findPaypalAccount, getBrandName } from '@/lib/paypalAccounts'
import { toCredentials, donorInfoFromCapture } from '@/lib/paypalDonations'

async function getPaypalSettings(supabase) {
  const { data: settings } = await supabase
    .from('settings')
    .select('payment_settings')
    .eq('id', 'global')
    .single()

  return settings?.payment_settings?.paypal || null
}

const BOT_USER_AGENT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i

// Referrer hosts grouped under one readable name; anything else shows as its host.
const SOURCE_BY_HOST = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'twitter'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)whatsapp\.(com|net)$/, 'whatsapp'],
  [/(^|\.)google\.[a-z.]+$/, 'google'],
]

function sourceFromReferrer(referrer) {
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    return SOURCE_BY_HOST.find(([pattern]) => pattern.test(host))?.[1] || host
  } catch {
    return 'direct'
  }
}

// Called once from the browser when a donation page opens. Bots and link
// previews are skipped so the counts reflect real visitors.
export async function recordPageView({ slug, visitorId, referrer, utmSource }) {
  const userAgent = (await headers()).get('user-agent') || ''
  if (!userAgent || BOT_USER_AGENT.test(userAgent)) return

  const supabase = createAdminClient()
  const { data: page } = await supabase.from('pages').select('id').eq('slug', slug).single()
  if (!page) return

  const cleanReferrer = typeof referrer === 'string' ? referrer.slice(0, 500) : ''
  const source = (typeof utmSource === 'string' && utmSource.trim().toLowerCase().slice(0, 50)) || sourceFromReferrer(cleanReferrer)

  await supabase.from('page_views').insert({
    page_id: page.id,
    visitor_id: typeof visitorId === 'string' ? visitorId.slice(0, 64) : null,
    source,
    referrer: cleanReferrer || null,
  })

  // Visits are frequent enough to send due payment reminders from here,
  // after the response, instead of needing a scheduler.
  const requestHeaders = await headers()
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host')
  const protocol = requestHeaders.get('x-forwarded-proto') || (host?.startsWith('localhost') ? 'http' : 'https')
  if (host) after(() => sendDueReminders(supabase, `${protocol}://${host}`))
}

const RESUME_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

// Lets a donor who left without paying pick up the same invoice again, from
// the link in their reminder email or from this browser's memory of it. Only
// unfinished online payments from the last few days can be resumed.
export async function getResumableDonation({ slug, invoiceNumber }) {
  if (typeof invoiceNumber !== 'string' || !/^INV-[A-Z0-9]{8}$/.test(invoiceNumber)) return null

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('donations')
    .select('invoice_number, amount, donor_name, is_anonymous, message, gateway, status, failure_reason, created_at, pages!inner(slug)')
    .eq('invoice_number', invoiceNumber)
    .eq('pages.slug', slug)
    .in('status', ['pending', 'failed'])
    .neq('gateway', 'bank')
    .gte('created_at', new Date(Date.now() - RESUME_MAX_AGE_MS).toISOString())
    .maybeSingle()
  if (!data || data.failure_reason === 'capture_declined') return null

  return {
    invoiceNumber: data.invoice_number,
    amount: Number(data.amount),
    name: data.donor_name || '',
    anonymous: data.is_anonymous,
    message: data.message || '',
    gateway: data.gateway,
  }
}

function donationProblem({ donorName, donorEmail, isAnonymous, amount }) {
  const numericAmount = Number(amount)
  if (!numericAmount || numericAmount < 1 || numericAmount > 10000) {
    return 'Amount must be between $1 and $10,000.'
  }
  if (!isAnonymous && !donorName?.trim()) {
    return 'Please enter your name, or choose to donate anonymously.'
  }
  if (donorEmail?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail.trim())) {
    return 'Please enter a valid email address, or leave it empty.'
  }
  return null
}

async function insertDonation(supabase, pageId, requestHeaders, { donorName, donorEmail, donorAddress, donorPhone, donorCountry, isAnonymous, amount, message, gateway }) {
  return supabase
    .from('donations')
    .insert({
      page_id: pageId,
      donor_name: donorName?.trim() || null,
      donor_email: donorEmail?.trim() || null,
      donor_address: donorAddress?.trim() || null,
      donor_phone: donorPhone?.trim() || null,
      donor_country: donorCountry?.trim() || null,
      is_anonymous: isAnonymous,
      amount: Number(amount),
      message: message?.trim() || null,
      gateway,
      status: 'pending',
      checkout_step: 'form',
      // The donor's browser, to see where checkouts get stuck (e.g. Facebook's in-app browser).
      user_agent: requestHeaders.get('user-agent')?.slice(0, 500) || null,
    })
    .select('invoice_number, amount')
    .single()
}

export async function submitDonation(fields) {
  const { slug, gateway } = fields
  const problem = donationProblem(fields)
  if (problem) return { error: problem }
  const numericAmount = Number(fields.amount)
  const supabase = createAdminClient()

  // Fetched together (and the PayPal settings up front) so the donor's click
  // doesn't wait on one request after another.
  const [{ data: page, error: pageError }, paypalSettings, requestHeaders] = await Promise.all([
    supabase.from('pages').select('id').eq('slug', slug).single(),
    gateway === 'paypal' || gateway === 'stripe' ? getPaypalSettings(supabase) : null,
    headers(),
  ])

  if (pageError || !page) {
    return { error: 'This donation page could not be found.' }
  }

  const { data, error } = await insertDonation(supabase, page.id, requestHeaders, fields)

  if (error) {
    return { error: 'Something went wrong. Please try again.' }
  }

  let redirectUrl = null
  let paypalClientId = null

  if (gateway === 'paypal' || gateway === 'stripe') {
    const account = getActivePaypalAccount(paypalSettings)

    if (account?.client_id && account?.secret) {
      // 'stripe' is this app's internal id for the "Card" option, but it's actually
      // powered by PayPal's Advanced Card Payments (Card Fields), not Stripe.
      paypalClientId = account.client_id
    } else if (gateway === 'paypal' && account?.email) {
      const params = new URLSearchParams({
        cmd: '_donations',
        business: account.email,
        item_name: `Donation — ${data.invoice_number}`,
        amount: numericAmount.toFixed(2),
        currency_code: 'USD',
        custom: data.invoice_number,
      })
      redirectUrl = `https://www.paypal.com/cgi-bin/webscr?${params.toString()}`
    }
  }

  return { success: true, invoiceNumber: data.invoice_number, redirectUrl, paypalClientId, gateway }
}

// The amount charged always comes from the invoice row, never from the
// browser, so the PayPal order can't differ from what the invoice records.
// clientId is the one the donor's page loaded PayPal with: using that account
// (rather than whichever is active now) keeps a page that was opened before the
// admin switched accounts working.
export async function createPaypalOrderAction({ invoiceNumber, clientId }) {
  const supabase = createAdminClient()
  const [paypal, { data: donation }] = await Promise.all([
    getPaypalSettings(supabase),
    supabase.from('donations').select('amount').eq('invoice_number', invoiceNumber).in('status', ['pending', 'failed']).single(),
  ])
  if (!donation) return { error: 'Could not start PayPal checkout. Please try again.' }
  return createOrderForInvoice({ supabase, paypal, clientId, invoiceNumber, amount: donation.amount })
}

// One round trip for the PayPal buttons and card fields: creates the invoice
// (unless invoiceNumber is a retry of an existing one) and its PayPal order
// together, so PayPal's card form opens sooner after the click.
export async function startPaypalCheckout({ invoiceNumber, clientId, details }) {
  if (invoiceNumber) return createPaypalOrderAction({ invoiceNumber, clientId })

  const problem = donationProblem(details)
  if (problem) return { error: problem }
  const supabase = createAdminClient()

  const [{ data: page }, paypal, requestHeaders] = await Promise.all([
    supabase.from('pages').select('id').eq('slug', details.slug).single(),
    getPaypalSettings(supabase),
    headers(),
  ])
  if (!page) return { error: 'This donation page could not be found.' }

  const { data, error } = await insertDonation(supabase, page.id, requestHeaders, details)
  if (error) return { error: 'Something went wrong. Please try again.' }

  const result = await createOrderForInvoice({ supabase, paypal, clientId, invoiceNumber: data.invoice_number, amount: data.amount })
  // The invoice exists either way, so a retry continues it instead of making another.
  return { ...result, invoiceNumber: data.invoice_number }
}

async function createOrderForInvoice({ supabase, paypal, clientId, invoiceNumber, amount }) {
  const account =
    getPaypalAccounts(paypal).find((a) => clientId && a.client_id === clientId) || getActivePaypalAccount(paypal)
  const credentials = toCredentials(account)
  if (!credentials) return { error: 'PayPal is not configured yet.' }

  try {
    const order = await createPaypalOrder({
      clientId: credentials.clientId,
      secret: credentials.secret,
      mode: credentials.mode,
      amount,
      invoiceNumber,
      brandName: getBrandName(paypal),
    })

    // checkout_step lets the admin tell "never opened PayPal" apart from "opened
    // it and left"; paypal_account_id records which account the money goes to,
    // and is what the capture must use; paypal_order_id lets the admin's PayPal
    // recovery capture this order later if the donor approves it but the page
    // is gone before it can capture. Saved after the response, so PayPal's form
    // doesn't wait on it; the capture falls back to the active account if it
    // ever runs first.
    after(async () => {
      await supabase
        .from('donations')
        .update({ checkout_step: 'paypal', paypal_account_id: credentials.accountId, paypal_order_id: order.id })
        .eq('invoice_number', invoiceNumber)
        .in('status', ['pending', 'failed'])
    })

    return { orderId: order.id }
  } catch {
    return { error: 'Could not start PayPal checkout. Please try again.' }
  }
}

// canRestart: true when the caller is a PayPal button that can reopen its
// checkout (actions.restart); card fields can't, so they get an error instead.
export async function capturePaypalOrderAction({ orderId, invoiceNumber, canRestart = false }) {
  const supabase = createAdminClient()
  const paypal = await getPaypalSettings(supabase)

  // An order can only be captured by the account that created it.
  const { data: donation } = await supabase
    .from('donations')
    .select('amount, paypal_account_id')
    .eq('invoice_number', invoiceNumber)
    .single()
  if (!donation) return { error: 'Payment could not be confirmed. Please contact support.' }
  const credentials = toCredentials(findPaypalAccount(paypal, donation.paypal_account_id) || getActivePaypalAccount(paypal))
  if (!credentials) return { error: 'PayPal is not configured yet.' }

  try {
    // Both ids come from the browser, and anyone with the public client id can
    // create an order, so the order has to be checked against this invoice
    // before capturing: otherwise a small order could complete a larger invoice.
    const order = await getPaypalOrder({
      clientId: credentials.clientId,
      secret: credentials.secret,
      mode: credentials.mode,
      orderId,
    })
    const unit = order?.purchase_units?.[0]
    if (
      unit?.invoice_id !== invoiceNumber ||
      unit?.amount?.currency_code !== 'USD' ||
      Number(unit?.amount?.value) !== Number(donation.amount)
    ) {
      return { error: 'Payment could not be confirmed. Please contact support.' }
    }

    const capture = await capturePaypalOrder({
      clientId: credentials.clientId,
      secret: credentials.secret,
      mode: credentials.mode,
      orderId,
    })

    const captureResult = capture?.purchase_units?.[0]?.payments?.captures?.[0]
    const captureId = captureResult?.id || orderId

    // PayPal can answer the capture call successfully while still declining the
    // payment itself, so the capture's own status has to be checked too.
    if (captureResult?.status === 'DECLINED') {
      await setDonationFailed(invoiceNumber, 'capture_declined', captureResult?.status_details?.reason || 'DECLINED')
      return { error: 'Your payment was declined. Please try another payment method.' }
    }

    await supabase
      .from('donations')
      .update({
        status: 'completed',
        gateway_reference: captureId,
        failure_reason: null,
        failure_code: null,
        ...donorInfoFromCapture(capture),
      })
      .eq('invoice_number', invoiceNumber)

    // Show the new donor on the cached donation pages right away.
    revalidatePath('/donate/[slug]', 'page')

    return { success: true }
  } catch (err) {
    // PayPal's recommended recovery for a declined funding source is to reopen
    // the checkout so the donor can pick another card or their PayPal balance.
    // The invoice stays pending meanwhile; cancelling from there marks it failed.
    if (err?.code === 'INSTRUMENT_DECLINED' && canRestart) {
      return { restart: true }
    }
    // The admin's PayPal recovery captured this order first: the money is in.
    if (err?.code === 'ORDER_ALREADY_CAPTURED') {
      const { data: current } = await supabase.from('donations').select('status').eq('invoice_number', invoiceNumber).single()
      if (current?.status === 'completed') return { success: true }
    }
    await setDonationFailed(invoiceNumber, 'capture_declined', err?.code || null)
    if (err?.code === 'INSTRUMENT_DECLINED') {
      return { error: 'Your card was declined. Please try another card or payment method.' }
    }
    return { error: 'Payment could not be confirmed. Please contact support.' }
  }
}

const BROWSER_FAILURE_REASONS = ['cancelled', 'checkout_error']

// Called from the browser when the donor cancels or the checkout errors out.
// The browser can only report cancelled/checkout_error; capture_declined is
// set server-side from PayPal's own response.
export async function markDonationFailed({ invoiceNumber, reason }) {
  const failureReason = BROWSER_FAILURE_REASONS.includes(reason) ? reason : 'checkout_error'
  await setDonationFailed(invoiceNumber, failureReason, null)
}

// Only touches online payments that are pending or already failed (a retry on
// the same invoice can fail again for a different reason), so a completed
// invoice or a bank transfer awaiting confirmation can never be flipped to failed.
async function setDonationFailed(invoiceNumber, failureReason, failureCode) {
  if (!invoiceNumber) return
  const supabase = createAdminClient()
  await supabase
    .from('donations')
    .update({ status: 'failed', failure_reason: failureReason, failure_code: failureCode })
    .eq('invoice_number', invoiceNumber)
    .in('status', ['pending', 'failed'])
    .neq('gateway', 'bank')
}
