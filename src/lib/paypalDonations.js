import 'server-only'
import { COUNTRIES } from '@/lib/countries'
import { findPaypalAccount } from '@/lib/paypalAccounts'
import { getPaypalOrder, capturePaypalOrder } from '@/lib/paypal'

export function toCredentials(account) {
  if (!account?.client_id || !account?.secret) return null
  return { accountId: account.id, clientId: account.client_id, secret: account.secret, mode: account.mode || 'sandbox' }
}

// The donation form no longer asks for email/address, so the invoice's donor
// details are filled in from what PayPal returns (PayPal account for PayPal /
// Apple Pay / Google Pay, the card's billing info for card payments). Works on
// both a capture response and an order read with getPaypalOrder.
export function donorInfoFromCapture(capture) {
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

// Orders younger than this may still be in a donor's open checkout, so they're
// left for the page itself to capture.
const MIN_AGE_MS = 15 * 60 * 1000
// PayPal orders that are never captured expire, so older ones aren't checked.
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000

// Finds pending (or cancelled-then-retried) invoices whose PayPal order the donor approved but that never
// got captured — typically because the donation page was closed or lost (in-app
// browsers, mobile tabs) before it could finish — and captures them now. Also
// picks up orders PayPal already captured while the invoice stayed pending.
// PayPal refuses a second capture of the same order, so this can't charge twice.
export async function recoverApprovedPaypalOrders(supabase) {
  const { data: settings } = await supabase.from('settings').select('payment_settings').eq('id', 'global').single()
  const paypal = settings?.payment_settings?.paypal

  const now = Date.now()
  const { data: pending } = await supabase
    .from('donations')
    .select('invoice_number, amount, paypal_order_id, paypal_account_id, created_at')
    // A donor who cancelled once and retried on the same invoice leaves it 'failed'.
    .in('status', ['pending', 'failed'])
    .neq('gateway', 'bank')
    .not('paypal_order_id', 'is', null)
    .gte('created_at', new Date(now - MAX_AGE_MS).toISOString())
    .lte('created_at', new Date(now - MIN_AGE_MS).toISOString())

  const result = { checked: 0, recovered: [], notApproved: 0, errors: 0 }

  for (const donation of pending || []) {
    const credentials = toCredentials(findPaypalAccount(paypal, donation.paypal_account_id))
    if (!credentials) {
      result.errors += 1
      continue
    }
    result.checked += 1

    try {
      let order = await getPaypalOrder({ ...credentials, orderId: donation.paypal_order_id })

      if (order.status === 'APPROVED') {
        try {
          order = await capturePaypalOrder({ ...credentials, orderId: donation.paypal_order_id })
        } catch (err) {
          // Captured by the donor's page in the meantime: read the final state.
          if (err?.code !== 'ORDER_ALREADY_CAPTURED') throw err
          order = await getPaypalOrder({ ...credentials, orderId: donation.paypal_order_id })
        }
      }

      const capture = order?.purchase_units?.[0]?.payments?.captures?.[0]
      if (order.status !== 'COMPLETED' || !capture || capture.status === 'DECLINED') {
        result.notApproved += 1
        continue
      }

      const { error } = await supabase
        .from('donations')
        .update({
          status: 'completed',
          gateway_reference: capture.id,
          failure_reason: null,
          failure_code: null,
          ...donorInfoFromCapture(order),
        })
        .eq('invoice_number', donation.invoice_number)
        .in('status', ['pending', 'failed'])
      if (error) throw error

      result.recovered.push({ invoiceNumber: donation.invoice_number, amount: Number(donation.amount) })
    } catch (err) {
      // PayPal deletes orders the donor never approved after a few hours, so a
      // missing order is an abandoned checkout, not a failure to check it.
      if (err?.code === 'INVALID_RESOURCE_ID') {
        result.notApproved += 1
        continue
      }
      console.error('PayPal recovery failed for', donation.invoice_number, err?.code || err)
      result.errors += 1
    }
  }

  return result
}
