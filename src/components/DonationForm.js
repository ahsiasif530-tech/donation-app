'use client'

import { useState } from 'react'
import {
  PayPalScriptProvider,
  PayPalButtons,
  PayPalCardFieldsProvider,
  PayPalCardFieldsForm,
  usePayPalCardFields,
} from '@paypal/react-paypal-js'
import { submitDonation, createPaypalOrderAction, capturePaypalOrderAction } from '@/app/donate/[slug]/actions'
import CountrySelect from './CountrySelect'
import { COUNTRIES } from '@/lib/countries'

const PRESET_AMOUNTS = [5, 10, 25, 50, 100, 150, 200, 250, 300, 500, 1000, 9999]

const GATEWAY_ORDER = ['paypal', 'stripe']
const GATEWAY_LABELS = { paypal: 'PayPal', stripe: 'Card' }

function GatewayIcon({ gateway }) {
  if (gateway === 'paypal') {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path fill="#003087" d="M8.5 4h6.2c3 0 4.6 1.5 4.1 4.3-.6 3.5-2.9 5.3-6.2 5.3h-2l-.9 5.4H6.3L8.5 4Z" />
        <path fill="#009cde" d="M10.3 6h6.2c1.7 0 2.8.6 3.1 2 .5 2.6-1.4 5.1-4.6 5.1h-2.2l-.9 5.4H8.6l1.7-12.5Z" />
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

function CardPaySubmitButton({ billingName, billingAddress, disabled }) {
  const { cardFieldsForm } = usePayPalCardFields()
  const [submitting, setSubmitting] = useState(false)

  async function handleClick() {
    if (!cardFieldsForm) return
    setSubmitting(true)
    try {
      await cardFieldsForm.submit({ name: billingName, billingAddress })
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || submitting}
      className="w-full rounded-xl py-3.5 text-base font-semibold text-white disabled:opacity-60"
      style={{ background: 'var(--gold)', fontFamily: 'var(--font-display)' }}
    >
      {submitting ? 'Processing…' : 'Pay'}
    </button>
  )
}

function Field({ label, required, ...props }) {
  return (
    <div>
      <label htmlFor={props.id} className="block text-sm font-semibold mb-2">
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

export default function DonationForm({ slug, enabledGateways }) {
  const orderedGateways = GATEWAY_ORDER.filter((g) => enabledGateways.includes(g))

  const [step, setStep] = useState('details')

  const [name, setName] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [amount, setAmount] = useState(25)
  const [message, setMessage] = useState('')
  const [gateway, setGateway] = useState(orderedGateways[0])

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [street, setStreet] = useState('')
  const [apartment, setApartment] = useState('')
  const [city, setCity] = useState('')
  const [zip, setZip] = useState('')
  const [country, setCountry] = useState('United States')
  const [phone, setPhone] = useState('')

  const [status, setStatus] = useState('idle')
  const [feedback, setFeedback] = useState('')
  const [paypalCheckout, setPaypalCheckout] = useState(null)

  function handleContinue(e) {
    e.preventDefault()
    setFeedback('')
    if (!anonymous && !name.trim()) {
      setFeedback('Please enter your name, or choose to donate anonymously.')
      return
    }
    if (!amount || amount < 1 || amount > 10000) {
      setFeedback('Amount must be between $1 and $10,000.')
      return
    }
    setStep('supporter-info')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('loading')
    setFeedback('')

    const address = [street, apartment, city, zip, country].filter(Boolean).join(', ')

    const result = await submitDonation({
      slug,
      donorName: name,
      donorEmail: email,
      donorAddress: address,
      donorPhone: phone,
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
      setPaypalCheckout({
        clientId: result.paypalClientId,
        invoiceNumber: result.invoiceNumber,
        amount,
        gateway: result.gateway,
        billingName: `${firstName} ${lastName}`.trim(),
        billingAddress: {
          addressLine1: street,
          addressLine2: apartment,
          adminArea2: city,
          postalCode: zip,
          countryCode: COUNTRIES.find((c) => c.name === country)?.code || 'US',
        },
      })
      setStatus('idle')
      return
    }

    setStatus('done')
    setFeedback(`Your donation has been recorded (invoice ${result.invoiceNumber}). You'll receive a confirmation once payment is processed.`)
  }

  if (status === 'done') {
    return (
      <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <p className="text-lg font-semibold" style={{ color: 'var(--heading)', fontFamily: 'var(--font-display)' }}>Thank you</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--ink-muted)' }}>{feedback}</p>
      </div>
    )
  }

  if (paypalCheckout) {
    const createOrder = async () => {
      const res = await createPaypalOrderAction({
        invoiceNumber: paypalCheckout.invoiceNumber,
        amount: paypalCheckout.amount,
      })
      if (res.error) {
        setFeedback(res.error)
        throw new Error(res.error)
      }
      return res.orderId
    }

    const onApprove = async (data) => {
      const res = await capturePaypalOrderAction({
        orderId: data.orderID,
        invoiceNumber: paypalCheckout.invoiceNumber,
      })
      if (res.error) {
        setFeedback(res.error)
        return
      }
      setStatus('done')
      setFeedback(`Thank you! Your donation (invoice ${paypalCheckout.invoiceNumber}) has been received.`)
    }

    const onError = () => setFeedback('Checkout failed. Please try again.')

    return (
      <div className="rounded-2xl border p-8 space-y-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <h2 className="text-lg font-semibold text-center" style={{ fontFamily: 'var(--font-display)', color: 'var(--heading)' }}>
          Complete your donation
        </h2>
        <p className="text-center text-sm" style={{ color: 'var(--ink-muted)' }}>
          ${Number(paypalCheckout.amount).toFixed(2)} — invoice {paypalCheckout.invoiceNumber}
        </p>

        {feedback && <p className="text-sm text-red-600 text-center">{feedback}</p>}

        {paypalCheckout.gateway === 'stripe' ? (
          <PayPalScriptProvider options={{ clientId: paypalCheckout.clientId, currency: 'USD', components: 'card-fields' }}>
            <PayPalCardFieldsProvider createOrder={createOrder} onApprove={onApprove} onError={onError}>
              <PayPalCardFieldsForm />
              <CardPaySubmitButton billingName={paypalCheckout.billingName} billingAddress={paypalCheckout.billingAddress} />
            </PayPalCardFieldsProvider>
          </PayPalScriptProvider>
        ) : (
          <PayPalScriptProvider options={{ clientId: paypalCheckout.clientId, currency: 'USD' }}>
            <PayPalButtons style={{ layout: 'vertical' }} createOrder={createOrder} onApprove={onApprove} onError={onError} />
          </PayPalScriptProvider>
        )}
      </div>
    )
  }

  if (step === 'supporter-info') {
    return (
      <form onSubmit={handleSubmit} className="rounded-2xl border shadow-sm p-8 space-y-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--heading)' }}>
            Supporter Information
          </h2>
          <button
            type="button"
            onClick={() => setStep('details')}
            className="text-sm font-medium"
            style={{ color: 'var(--ink-muted)' }}
          >
            ← Back
          </button>
        </div>

        <Field id="email" label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />

        <div className="grid grid-cols-2 gap-3">
          <Field id="first-name" label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <Field id="last-name" label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>

        <Field id="street" label="Street address" required value={street} onChange={(e) => setStreet(e.target.value)} />
        <Field id="apartment" label="Apartment, suite, unit, etc." value={apartment} onChange={(e) => setApartment(e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Field id="city" label="Town / City" required value={city} onChange={(e) => setCity(e.target.value)} />
          <Field id="zip" label="ZIP code" required value={zip} onChange={(e) => setZip(e.target.value)} />
        </div>

        <div>
          <label htmlFor="country" className="block text-sm font-semibold mb-2">
            Country / Region <span style={{ color: 'var(--gold-bright)' }}>*</span>
          </label>
          <CountrySelect value={country} onChange={setCountry} />
        </div>
        <Field id="phone" label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />

        {feedback && <p className="text-sm text-red-600">{feedback}</p>}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full rounded-xl py-3.5 text-base font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--gold)', fontFamily: 'var(--font-display)' }}
        >
          {status === 'loading' ? 'Processing…' : gateway === 'stripe' ? 'Pay' : 'Donate Now'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleContinue} className="rounded-2xl border shadow-sm p-8 space-y-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <Field id="donor-name" label="Your Name" required value={name} disabled={anonymous} onChange={(e) => setName(e.target.value)} placeholder={anonymous ? 'Hidden (donating anonymously)' : 'Enter your name'} />

      <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Donate anonymously
      </label>

      <div>
        <label className="block text-sm font-semibold mb-2 text-center">Choose an amount</label>
        <div className="grid grid-cols-6 gap-2 max-[420px]:grid-cols-3">
          {PRESET_AMOUNTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              className="rounded-lg border py-2.5 text-sm font-semibold tabular-nums transition-colors"
              style={
                amount === a
                  ? { background: 'var(--gold)', borderColor: 'var(--gold)', color: '#fff' }
                  : { borderColor: 'var(--border)', background: 'var(--surface-2)' }
              }
            >
              ${a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="amount-input" className="block text-sm font-semibold mb-2">
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
          className="w-full rounded-lg border px-3 py-3 text-center text-xl font-semibold tabular-nums focus:outline-none"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', fontFamily: 'var(--font-display)' }}
        />
        <p className="mt-2 text-center text-xs" style={{ color: 'var(--ink-muted)' }}>Min $1 &middot; Max $10,000</p>
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-semibold mb-2">Message</label>
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
        <label className="block text-sm font-semibold mb-2">Payment method</label>
        <div className="rounded-lg border divide-y overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {orderedGateways.map((g) => (
            <label
              key={g}
              className="flex items-center gap-3 px-4 py-3 text-sm cursor-pointer"
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
                style={{ accentColor: 'var(--gold)' }}
              />
              <GatewayIcon gateway={g} />
              <span className="font-medium">{GATEWAY_LABELS[g]}</span>
            </label>
          ))}
        </div>
      </div>

      {feedback && <p className="text-sm text-red-600">{feedback}</p>}

      <button
        type="submit"
        className="w-full rounded-xl py-3.5 text-base font-semibold text-white disabled:opacity-60"
        style={{ background: 'var(--gold)', fontFamily: 'var(--font-display)' }}
      >
        Donate Now
      </button>
    </form>
  )
}
