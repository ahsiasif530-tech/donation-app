'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PayPalScriptProvider,
  PayPalButtons,
  PayPalCardFieldsProvider,
  PayPalCardFieldsForm,
  usePayPalCardFields,
} from '@paypal/react-paypal-js'
import { submitDonation, createPaypalOrderAction, capturePaypalOrderAction, getPaypalClientId, markDonationFailed } from '@/app/donate/[slug]/actions'

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 150, 200, 250, 300, 500, 1000, 9999]

const GATEWAY_ORDER = ['paypal', 'applepay', 'googlepay', 'stripe', 'bank']
const GATEWAY_LABELS = { paypal: 'PayPal', applepay: 'Apple Pay', googlepay: 'Google Pay', stripe: 'Credit or Debit Card', bank: 'Bank Transfer' }
const EXPRESS_GATEWAYS = ['applepay', 'googlepay']

function GatewayIcon({ gateway }) {
  if (gateway === 'paypal') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path fill="#003087" d="M8.5 4h6.2c3 0 4.6 1.5 4.1 4.3-.6 3.5-2.9 5.3-6.2 5.3h-2l-.9 5.4H6.3L8.5 4Z" />
        <path fill="#009cde" d="M10.3 6h6.2c1.7 0 2.8.6 3.1 2 .5 2.6-1.4 5.1-4.6 5.1h-2.2l-.9 5.4H8.6l1.7-12.5Z" />
      </svg>
    )
  }
  if (gateway === 'bank') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 10l9-6 9 6" />
        <path d="M4.5 10v9M9 10v9M15 10v9M19.5 10v9" />
        <path d="M2.5 19h19" />
      </svg>
    )
  }
  if (gateway === 'applepay') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.5 3.5c-.9 1.07-2.3 1.9-3.7 1.79-.18-1.4.5-2.87 1.32-3.78C15 .43 16.5-.3 17.7 0c.14 1.46-.42 2.9-1.2 3.5Zm1.18 2.02c-2.05-.12-3.8 1.16-4.78 1.16-1 0-2.5-1.1-4.14-1.07-2.13.03-4.1 1.24-5.19 3.16-2.23 3.86-.58 9.58 1.58 12.72 1.06 1.55 2.32 3.27 3.98 3.21 1.6-.06 2.2-1.04 4.13-1.04s2.48 1.04 4.17 1.01c1.73-.03 2.82-1.56 3.87-3.12 1.22-1.78 1.72-3.5 1.75-3.59-.04-.02-3.36-1.3-3.39-5.14-.03-3.22 2.63-4.76 2.75-4.84-1.5-2.22-3.84-2.46-4.68-2.46Z"
        />
      </svg>
    )
  }
  if (gateway === 'googlepay') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path fill="#4285F4" d="M12 10.9v2.4h3.6c-.15 1-.9 2.5-3.6 2.5-2.17 0-3.94-1.8-3.94-4s1.77-4 3.94-4c1.24 0 2.06.53 2.53.98l1.73-1.66C15.16 5.98 13.72 5.3 12 5.3c-3.7 0-6.7 3-6.7 6.7s3 6.7 6.7 6.7c3.87 0 6.43-2.72 6.43-6.55 0-.44-.05-.78-.1-1.11H12Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="5" width="19" height="14" rx="2.2" />
      <path d="M2.5 9.5h19" />
    </svg>
  )
}

// Registers the inline card-fields submit function onto a ref so the outer
// form's single "Pay" button can trigger it after the donation row exists.
function CardFieldsBridge({ submitRef }) {
  const { cardFieldsForm } = usePayPalCardFields()

  useEffect(() => {
    submitRef.current = cardFieldsForm ? () => cardFieldsForm.submit() : null
    return () => {
      submitRef.current = null
    }
  }, [cardFieldsForm, submitRef])

  return null
}

function Field({ label, required, ...props }) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-sm font-bold mb-2">
        {label} {required && <span style={{ color: 'var(--gold-bright)' }}>*</span>}
      </label>
      <input
        className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        required={required}
        {...props}
      />
    </div>
  )
}

export default function DonationForm({
  slug,
  enabledGateways,
  cardEnabled = true,
  paypalEnabled = true,
  bankEnabled = false,
  bankDetails = null,
  applepayEnabled = false,
  googlepayEnabled = false,
}) {
  const orderedGateways = GATEWAY_ORDER.filter(
    (g) =>
      enabledGateways.includes(g) &&
      (g !== 'paypal' || paypalEnabled) &&
      (g !== 'stripe' || cardEnabled) &&
      (g !== 'bank' || bankEnabled) &&
      (g !== 'applepay' || applepayEnabled) &&
      (g !== 'googlepay' || googlepayEnabled)
  )

  const [name, setName] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [amount, setAmount] = useState(25)
  const [message, setMessage] = useState('')
  const [gateway, setGateway] = useState(orderedGateways[0])

  const [status, setStatus] = useState('idle')
  const [feedback, setFeedback] = useState('')
  const [paypalCheckout, setPaypalCheckout] = useState(null)
  const [cardClientId, setCardClientId] = useState(null)

  const invoiceNumberRef = useRef(null)
  const cardFieldsSubmitRef = useRef(null)

  useEffect(() => {
    if (!orderedGateways.some((g) => g === 'stripe' || EXPRESS_GATEWAYS.includes(g))) return
    getPaypalClientId().then(setCardClientId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cardScriptOptions = useMemo(
    () => ({ clientId: cardClientId, currency: 'USD', components: 'card-fields' }),
    [cardClientId]
  )

  // Apple Pay / Google Pay ride on the same PayPal merchant app as PayPal itself,
  // rendered as PayPal's own official button widgets (required by both Apple's and
  // Google's branding rules — a custom button can't trigger their payment sheets).
  const expressScriptOptions = useMemo(
    () => ({ clientId: cardClientId, currency: 'USD', components: 'buttons,applepay,googlepay' }),
    [cardClientId]
  )

  // Called by the PayPal SDK itself once the popup/bridge is already open, so the
  // donation row is created here (not before cardFieldsForm.submit()) to avoid
  // delaying that submit() call past the original click — a delay there is what
  // causes the SDK's "Window closed before response" error. Also used by the
  // Apple Pay / Google Pay buttons, which trigger this directly without ever
  // going through the form's own submit handler.
  const createOrder = async () => {
    if (!invoiceNumberRef.current) {
      const validationError = validateDetails()
      if (validationError) {
        setFeedback(validationError)
        throw new Error(validationError)
      }

      const donationResult = await submitDonation({
        slug,
        donorName: name,
        isAnonymous: anonymous,
        amount,
        message,
        gateway,
      })
      if (donationResult.error) {
        setFeedback(donationResult.error)
        throw new Error(donationResult.error)
      }
      invoiceNumberRef.current = donationResult.invoiceNumber
    }

    const res = await createPaypalOrderAction({ invoiceNumber: invoiceNumberRef.current, amount })
    if (res.error) {
      setFeedback(res.error)
      throw new Error(res.error)
    }
    return res.orderId
  }

  // Shared by the card fields (no actions) and the Apple Pay / Google Pay
  // buttons (actions.restart reopens checkout after a declined card).
  const onApprove = async (data, actions) => {
    const res = await capturePaypalOrderAction({
      orderId: data.orderID,
      invoiceNumber: invoiceNumberRef.current,
      canRestart: Boolean(actions?.restart),
    })
    if (res.restart) {
      setFeedback('Your payment method was declined. Please choose another one.')
      return actions.restart()
    }
    if (res.error) {
      setStatus('idle')
      setFeedback(res.error)
      return
    }
    setStatus('done')
    setFeedback(`Thank you for your kindness! Your donation (invoice ${invoiceNumberRef.current}) has been received. May God bless you and your family.`)
  }

  const onError = (err) => {
    console.error('PayPal card fields error:', err)
    markDonationFailed({ invoiceNumber: invoiceNumberRef.current, reason: 'checkout_error' })
    setStatus('idle')
    setFeedback('Checkout failed. Please try again.')
  }

  const onCancel = () => {
    markDonationFailed({ invoiceNumber: invoiceNumberRef.current, reason: 'cancelled' })
    setStatus('idle')
    setFeedback('Payment was cancelled.')
  }

  function validateDetails() {
    if (!anonymous && !name.trim()) return 'Please enter your name, or choose to donate anonymously.'
    if (!amount || amount < 1 || amount > 10000) return 'Amount must be between $1 and $10,000.'
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFeedback('')

    if (EXPRESS_GATEWAYS.includes(gateway)) {
      setFeedback(`Please use the ${GATEWAY_LABELS[gateway]} button above to complete your donation.`)
      return
    }

    const validationError = validateDetails()
    if (validationError) {
      setFeedback(validationError)
      return
    }

    if (gateway === 'stripe') {
      if (!cardClientId) {
        setFeedback('Card payment is not set up yet. Please try PayPal instead.')
        return
      }
      if (!cardFieldsSubmitRef.current) {
        setFeedback('The card form is still loading. Please try again in a moment.')
        return
      }
      setStatus('loading')
      try {
        await cardFieldsSubmitRef.current()
      } catch (err) {
        console.error('Card payment submit failed:', err)
        markDonationFailed({ invoiceNumber: invoiceNumberRef.current, reason: 'checkout_error' })
        setStatus('idle')
        setFeedback('Please check your card details and try again.')
      }
      return
    }

    setStatus('loading')

    const result = await submitDonation({
      slug,
      donorName: name,
      isAnonymous: anonymous,
      amount,
      message,
      gateway,
    })

    if (result.error) {
      setStatus('idle')
      setFeedback(result.error)
      return
    }

    if (result.redirectUrl) {
      window.location.href = result.redirectUrl
      return
    }

    if (result.paypalClientId) {
      setPaypalCheckout({ clientId: result.paypalClientId, invoiceNumber: result.invoiceNumber, amount })
      setStatus('idle')
      return
    }

    setStatus('done')
    setFeedback(`Your generosity means the world to us. Your donation (invoice ${result.invoiceNumber}) has been recorded, and you'll receive a confirmation once payment is processed. May God bless you abundantly.`)
  }

  if (status === 'done') {
    return (
      <div className="d-card rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-lg font-semibold" style={{ color: 'var(--heading)', fontFamily: 'var(--font-display)' }}>God Bless You 🙏</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>{feedback}</p>

        {gateway === 'bank' && bankDetails && (
          <div className="mt-6 rounded-xl border p-5 text-left space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
            <p className="text-sm font-bold mb-1">Please send your donation to:</p>
            {bankDetails.account_name && <p className="text-sm"><span style={{ color: 'var(--ink-muted)' }}>Account holder:</span> {bankDetails.account_name}</p>}
            {bankDetails.bank_name && <p className="text-sm"><span style={{ color: 'var(--ink-muted)' }}>Bank:</span> {bankDetails.bank_name}</p>}
            {bankDetails.account_number && <p className="text-sm"><span style={{ color: 'var(--ink-muted)' }}>Account number:</span> {bankDetails.account_number}</p>}
            {bankDetails.iban && <p className="text-sm"><span style={{ color: 'var(--ink-muted)' }}>IBAN:</span> {bankDetails.iban}</p>}
            {bankDetails.swift && <p className="text-sm"><span style={{ color: 'var(--ink-muted)' }}>SWIFT / BIC:</span> {bankDetails.swift}</p>}
          </div>
        )}
      </div>
    )
  }

  if (paypalCheckout) {
    const createPaypalButtonOrder = async () => {
      const res = await createPaypalOrderAction({ invoiceNumber: paypalCheckout.invoiceNumber, amount: paypalCheckout.amount })
      if (res.error) {
        setFeedback(res.error)
        throw new Error(res.error)
      }
      return res.orderId
    }

    const onApprovePaypalButton = async (data, actions) => {
      const res = await capturePaypalOrderAction({
        orderId: data.orderID,
        invoiceNumber: paypalCheckout.invoiceNumber,
        canRestart: true,
      })
      if (res.restart) {
        setFeedback('Your payment method was declined. Please choose another one.')
        return actions.restart()
      }
      if (res.error) {
        setFeedback(res.error)
        return
      }
      setStatus('done')
      setFeedback(`Thank you for your kindness! Your donation (invoice ${paypalCheckout.invoiceNumber}) has been received. May God bless you and your family.`)
    }

    return (
      <div className="d-card rounded-2xl border p-8 space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <h2 className="text-lg font-semibold text-center" style={{ fontFamily: 'var(--font-display)', color: 'var(--heading)' }}>
          Complete your donation
        </h2>
        <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          ${Number(paypalCheckout.amount).toFixed(2)} — invoice {paypalCheckout.invoiceNumber}
        </p>

        {feedback && <p className="text-sm text-red-600 text-center">{feedback}</p>}

        <PayPalScriptProvider options={{ clientId: paypalCheckout.clientId, currency: 'USD' }}>
          <PayPalButtons
            style={{ layout: 'vertical' }}
            createOrder={createPaypalButtonOrder}
            onApprove={onApprovePaypalButton}
            onCancel={() => {
              markDonationFailed({ invoiceNumber: paypalCheckout.invoiceNumber, reason: 'cancelled' })
              setFeedback('Payment was cancelled.')
            }}
            onError={() => {
              markDonationFailed({ invoiceNumber: paypalCheckout.invoiceNumber, reason: 'checkout_error' })
              setFeedback('Checkout failed. Please try again.')
            }}
          />
        </PayPalScriptProvider>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="d-card rounded-2xl border p-8 space-y-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <Field id="donor-name" label="Your Name" required value={name} disabled={anonymous} onChange={(e) => setName(e.target.value)} placeholder={anonymous ? 'Hidden (donating anonymously)' : 'Enter your name'} />

      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Donate anonymously
      </label>

      <div>
        <label className="block text-sm font-bold mb-2 text-center">Choose an amount</label>
        <div className="grid grid-cols-6 gap-2 max-[420px]:grid-cols-3">
          {PRESET_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              className={`rounded-lg border py-2.5 text-sm font-bold tabular-nums transition-colors ${amount === a ? 'd-btn-gold' : ''}`}
              style={amount === a ? {} : { borderColor: 'var(--border)', background: 'var(--surface-2)' }}
            >
              ${a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="amount-input" className="block text-sm font-bold mb-2">
          Amount (USD) <span style={{ color: 'var(--gold-bright)' }}>*</span>
        </label>
        <input
          id="amount-input"
          type="number"
          min="1"
          max="10000"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border px-3 py-3 text-center text-2xl font-bold tabular-nums focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', fontFamily: 'var(--font-display)' }}
        />
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--ink-muted)' }}>Min $1 &middot; Max $10,000</p>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-bold mb-2">Message</label>
        <textarea
          id="message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Leave a kind message (optional)"
          className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
        />
      </div>

      <div>
        <label className="block text-sm font-bold mb-2">Payment method</label>
        <div className="rounded-xl border divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {orderedGateways.map((g) => (
            <label
              key={g}
              className="flex items-center gap-4 px-6 py-5 text-base cursor-pointer"
              style={{
                background: gateway === g ? 'var(--surface-2)' : 'var(--surface)',
                borderColor: 'var(--border)',
              }}
            >
              <input
                type="radio"
                name="gateway"
                checked={gateway === g}
                onChange={() => setGateway(g)}
                style={{ accentColor: 'var(--gold)', width: 20, height: 20 }}
              />
              <span className="scale-125 origin-left">
                <GatewayIcon gateway={g} />
              </span>
              <span className="font-bold text-lg">{GATEWAY_LABELS[g]}</span>
            </label>
          ))}
        </div>
      </div>

      {gateway === 'stripe' && (
        <div className="border-t pt-6 space-y-3" style={{ borderColor: 'var(--border)' }}>
          <label className="block text-sm font-bold">
            Card details <span style={{ color: 'var(--gold-bright)' }}>*</span>
          </label>
          {cardClientId ? (
            <PayPalScriptProvider options={cardScriptOptions}>
              <PayPalCardFieldsProvider createOrder={createOrder} onApprove={onApprove} onError={onError}>
                <PayPalCardFieldsForm />
                <CardFieldsBridge submitRef={cardFieldsSubmitRef} />
              </PayPalCardFieldsProvider>
            </PayPalScriptProvider>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading card form…</p>
          )}
        </div>
      )}

      {EXPRESS_GATEWAYS.includes(gateway) && (
        <div className="border-t pt-6 space-y-3" style={{ borderColor: 'var(--border)' }}>
          <label className="block text-sm font-bold">Complete with {GATEWAY_LABELS[gateway]}</label>
          {cardClientId ? (
            <PayPalScriptProvider options={expressScriptOptions}>
              <PayPalButtons
                fundingSource={gateway}
                style={{ layout: 'vertical', height: 45 }}
                createOrder={createOrder}
                onApprove={onApprove}
                onCancel={onCancel}
                onError={onError}
              />
            </PayPalScriptProvider>
          ) : (
            <p className="text-sm" style={{ color: 'var(--ink-muted)' }}>Loading {GATEWAY_LABELS[gateway]}…</p>
          )}
        </div>
      )}

      {feedback && <p className="text-sm text-red-600">{feedback}</p>}

      {!EXPRESS_GATEWAYS.includes(gateway) && (
        <button
          type="submit"
          disabled={status === 'loading'}
          className="d-btn-gold w-full rounded-xl py-3.5 text-base font-bold disabled:opacity-60"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {status === 'loading' ? 'Processing…' : gateway === 'stripe' ? 'Pay' : 'Donate Now'}
        </button>
      )}
    </form>
  )
}
