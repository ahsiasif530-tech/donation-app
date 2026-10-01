import 'server-only'

function apiBase(mode) {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

// PayPal access tokens last hours, so a warm server reuses one instead of
// spending an extra PayPal request on every checkout click and capture.
const tokenCache = new Map()

async function getAccessToken(clientId, secret, mode) {
  const cacheKey = `${mode}:${clientId}:${secret}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.token

  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const res = await fetch(`${apiBase(mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error('Failed to authenticate with PayPal')
  const data = await res.json()
  // Refreshed 5 minutes early so a token never expires mid-request.
  const expiresInMs = (Number(data.expires_in) || 0) * 1000 - 5 * 60 * 1000
  if (expiresInMs > 0) tokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + expiresInMs })
  return data.access_token
}

export async function createPaypalOrder({ clientId, secret, mode, amount, invoiceNumber, brandName }) {
  const token = await getAccessToken(clientId, secret, mode)
  const res = await fetch(`${apiBase(mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: invoiceNumber,
          invoice_id: invoiceNumber,
          amount: { currency_code: 'USD', value: Number(amount).toFixed(2) },
        },
      ],
      // Shown at the top of PayPal's checkout in place of the account's own name.
      ...(brandName && { application_context: { brand_name: brandName } }),
    }),
  })
  if (!res.ok) {
    console.error('PayPal create order failed:', res.status, await res.text())
    throw new Error('Failed to create PayPal order')
  }
  return res.json()
}

export async function capturePaypalOrder({ clientId, secret, mode, orderId }) {
  const token = await getAccessToken(clientId, secret, mode)
  const res = await fetch(`${apiBase(mode)}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
  const body = await res.text()
  if (!res.ok) {
    console.error('PayPal capture order failed:', res.status, body)
    const error = new Error('Failed to capture PayPal order')
    error.code = paypalErrorCode(body) || `HTTP_${res.status}`
    throw error
  }
  return JSON.parse(body)
}

// Current state of an order: CREATED (donor never approved), APPROVED (approved
// but not captured yet), COMPLETED (captured), VOIDED, etc.
export async function getPaypalOrder({ clientId, secret, mode, orderId }) {
  const token = await getAccessToken(clientId, secret, mode)
  const res = await fetch(`${apiBase(mode)}/v2/checkout/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.text()
  if (!res.ok) {
    const error = new Error('Failed to read PayPal order')
    error.code = paypalErrorCode(body) || `HTTP_${res.status}`
    throw error
  }
  return JSON.parse(body)
}

// PayPal error bodies look like { name, details: [{ issue: 'INSTRUMENT_DECLINED', ... }] }.
function paypalErrorCode(body) {
  try {
    const data = JSON.parse(body)
    return data?.details?.[0]?.issue || data?.name || null
  } catch {
    return null
  }
}
