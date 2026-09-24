import 'server-only'

function apiBase(mode) {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

async function getAccessToken(clientId, secret, mode) {
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
  return data.access_token
}

export async function createPaypalOrder({ clientId, secret, mode, amount, invoiceNumber }) {
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

// PayPal error bodies look like { name, details: [{ issue: 'INSTRUMENT_DECLINED', ... }] }.
function paypalErrorCode(body) {
  try {
    const data = JSON.parse(body)
    return data?.details?.[0]?.issue || data?.name || null
  } catch {
    return null
  }
}
