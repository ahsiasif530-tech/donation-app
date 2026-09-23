'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createPaypalOrder, capturePaypalOrder } from '@/lib/paypal'
import { COUNTRIES } from '@/lib/countries'

async function getPaypalSettings(supabase) {
  const { data: settings } = await supabase
    .from('settings')
    .select('payment_settings')
    .eq('id', 'global')
    .single()

  return settings?.payment_settings?.paypal || null
}

async function getPaypalCredentials(supabase) {
  const paypal = await getPaypalSettings(supabase)
  if (!paypal?.client_id || !paypal?.secret) return null
  return { clientId: paypal.client_id, secret: paypal.secret, email: paypal.email, mode: paypal.mode || 'sandbox' }
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

export async function getPaypalClientId() {
  const supabase = createAdminClient()
  const paypal = await getPaypalSettings(supabase)
  return paypal?.client_id || null
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
    })
    .select('invoice_number')
    .single()

  if (error) {
    return { error: 'Something went wrong. Please try again.' }
  }

  let redirectUrl = null
  let paypalClientId = null

  if (gateway === 'paypal' || gateway === 'stripe') {
    const paypal = await getPaypalSettings(supabase)

    if (paypal?.client_id && paypal?.secret) {
      // 'stripe' is this app's internal id for the "Card" option, but it's actually
      // powered by PayPal's Advanced Card Payments (Card Fields), not Stripe.
      paypalClientId = paypal.client_id
    } else if (gateway === 'paypal' && paypal?.email) {
      const params = new URLSearchParams({
        cmd: '_donations',
        business: paypal.email,
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

export async function createPaypalOrderAction({ invoiceNumber, amount }) {
  const supabase = createAdminClient()
  const credentials = await getPaypalCredentials(supabase)
  if (!credentials) return { error: 'PayPal is not configured yet.' }

  try {
    const order = await createPaypalOrder({
      clientId: credentials.clientId,
      secret: credentials.secret,
      mode: credentials.mode,
      amount,
      invoiceNumber,
    })
    return { orderId: order.id }
  } catch {
    return { error: 'Could not start PayPal checkout. Please try again.' }
  }
}

export async function capturePaypalOrderAction({ orderId, invoiceNumber }) {
  const supabase = createAdminClient()
  const credentials = await getPaypalCredentials(supabase)
  if (!credentials) return { error: 'PayPal is not configured yet.' }

  try {
    const capture = await capturePaypalOrder({
      clientId: credentials.clientId,
      secret: credentials.secret,
      mode: credentials.mode,
      orderId,
    })

    const captureId = capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || orderId

    await supabase
      .from('donations')
      .update({ status: 'completed', gateway_reference: captureId, ...donorInfoFromCapture(capture) })
      .eq('invoice_number', invoiceNumber)

    return { success: true }
  } catch {
    await markDonationFailed({ invoiceNumber })
    return { error: 'Payment could not be confirmed. Please contact support.' }
  }
}

// Called when the donor cancels or the payment errors out. Only touches
// still-pending online payments, so a completed invoice or a bank transfer
// awaiting confirmation can never be flipped to failed from the browser.
export async function markDonationFailed({ invoiceNumber }) {
  if (!invoiceNumber) return
  const supabase = createAdminClient()
  await supabase
    .from('donations')
    .update({ status: 'failed' })
    .eq('invoice_number', invoiceNumber)
    .eq('status', 'pending')
    .neq('gateway', 'bank')
}
