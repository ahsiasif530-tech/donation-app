'use server'

import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPaypalOrder, capturePaypalOrder } from '@/lib/paypal'
import { COUNTRIES } from '@/lib/countries'
import { getPaypalAccounts, getActivePaypalAccount, findPaypalAccount } from '@/lib/paypalAccounts'

async function getPaypalSettings(supabase) {
  const { data: settings } = await supabase
    .from('settings')
    .select('payment_settings')
    .eq('id', 'global')
    .single()

  return settings?.payment_settings?.paypal || null
}

function toCredentials(account) {
  if (!account?.client_id || !account?.secret) return null
  return { accountId: account.id, clientId: account.client_id, secret: account.secret, mode: account.mode || 'sandbox' }
}

// The donation form no longer asks for email/address, so the invoice's donor
// details are filled in from what PayPal returns (PayPal account for PayPal /
// Apple Pay / Google Pay, the card's billing info for card payments).
function donorInfoFromCapture(capture) {
  const card = capture?.payment_source?.card
  const address = capture?.payer?.address || card?.billing_address || capture?.purchase_units?.[0]?.shipping?.address
  const countryCode = address?.country_code
  const info = {
    donor_email: capture?.payer?.email_address,
    donor_phone: capture?.payer?.phone?.phone_number?.national_number,
    donor_country: COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode,
    donor_address: [address?.admin_area_2, address?.postal_code, countryCode].filter(Boolean).join(', '),
  }
  return Object.fromEntries(Object.entries(info).filter(([, v]) => v))
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
}

export async function getPaypalClientId() {
  const supabase = createAdminClient()
  const paypal = await getPaypalSettings(supabase)
  return getActivePaypalAccount(paypal)?.client_id || null
}

export async function submitDonation({ slug, donorName, donorEmail, donorAddress, donorPhone, donorCountry, isAnonymous, amount, message, gateway }) {
  const numericAmount = Number(amount)

  if (!numericAmount || numericAmount < 1 || numericAmount > 10000) {
    return { error: 'Amount must be between $1 and $10,000.' }
  }
  if (!isAnonymous && !donorName?.trim()) {
    return { error: 'Please enter your name, or choose to donate anonymously.' }
  }
  const supabase = createAdminClient()

  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('id')
    .eq('slug', slug)
    .single()

  if (pageError || !page) {
    return { error: 'This donation page could not be found.' }
  }

  const { data, error } = await supabase
    .from('donations')
    .insert({
      page_id: page.id,
      donor_name: donorName?.trim() || null,
      donor_email: donorEmail?.trim() || null,
      donor_address: donorAddress?.trim() || null,
      donor_phone: donorPhone?.trim() || null,
      donor_country: donorCountry?.trim() || null,
      is_anonymous: isAnonymous,
      amount: numericAmount,
      message: message?.trim() || null,
      gateway,
      status: 'pending',
      checkout_step: 'form',
    })
    .select('invoice_number')
    .single()

  if (error) {
    return { error: 'Something went wrong. Please try again.' }
  }

  let redirectUrl = null
  let paypalClientId = null

  if (gateway === 'paypal' || gateway === 'stripe') {
    const account = getActivePaypalAccount(await getPaypalSettings(supabase))

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
  const paypal = await getPaypalSettings(supabase)
  const account =
    getPaypalAccounts(paypal).find((a) => clientId && a.client_id === clientId) || getActivePaypalAccount(paypal)
  const credentials = toCredentials(account)
  if (!credentials) return { error: 'PayPal is not configured yet.' }

  const { data: donation } = await supabase
    .from('donations')
    .select('amount')
    .eq('invoice_number', invoiceNumber)
    .in('status', ['pending', 'failed'])
    .single()
  if (!donation) return { error: 'Could not start PayPal checkout. Please try again.' }

  try {
    const order = await createPaypalOrder({
      clientId: credentials.clientId,
      secret: credentials.secret,
      mode: credentials.mode,
      amount: donation.amount,
      invoiceNumber,
    })

    // checkout_step lets the admin tell "never opened PayPal" apart from "opened
    // it and left"; paypal_account_id records which account the money goes to,
    // and is what the capture must use.
    await supabase
      .from('donations')
      .update({ checkout_step: 'paypal', paypal_account_id: credentials.accountId })
      .eq('invoice_number', invoiceNumber)
      .in('status', ['pending', 'failed'])

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
    .select('paypal_account_id')
    .eq('invoice_number', invoiceNumber)
    .single()
  const credentials = toCredentials(findPaypalAccount(paypal, donation?.paypal_account_id) || getActivePaypalAccount(paypal))
  if (!credentials) return { error: 'PayPal is not configured yet.' }

  try {
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

    return { success: true }
  } catch (err) {
    // PayPal's recommended recovery for a declined funding source is to reopen
    // the checkout so the donor can pick another card or their PayPal balance.
    // The invoice stays pending meanwhile; cancelling from there marks it failed.
    if (err?.code === 'INSTRUMENT_DECLINED' && canRestart) {
      return { restart: true }
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
