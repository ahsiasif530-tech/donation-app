'use client'

import { useState } from 'react'
import { updatePaymentSettings } from '@/app/admin/settings/actions'

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-sm mb-1.5" style={{ color: 'var(--a-text-muted)' }}>{label}</label>
      <input
        type="text"
        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
        style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
        {...props}
      />
    </div>
  )
}

export default function PaymentSettingsForm({ initialSettings }) {
  const s = initialSettings || {}

  const [paypalEmail, setPaypalEmail] = useState(s.paypal?.email || '')
  const [paypalClientId, setPaypalClientId] = useState(s.paypal?.client_id || '')
  const [paypalSecret, setPaypalSecret] = useState(s.paypal?.secret || '')

  const [bankAccountName, setBankAccountName] = useState(s.bank?.account_name || '')
  const [bankAccountNumber, setBankAccountNumber] = useState(s.bank?.account_number || '')
  const [bankName, setBankName] = useState(s.bank?.bank_name || '')
  const [bankIban, setBankIban] = useState(s.bank?.iban || '')
  const [bankSwift, setBankSwift] = useState(s.bank?.swift || '')

  const [otherName, setOtherName] = useState(s.other?.name || s.payoneer?.name || '')
  const [otherDetails, setOtherDetails] = useState(s.other?.details || s.payoneer?.details || '')

  const [cardProcessor, setCardProcessor] = useState(s.card?.processor || 'Stripe')
  const [cardPublishableKey, setCardPublishableKey] = useState(s.card?.publishable_key || '')
  const [cardSecretKey, setCardSecretKey] = useState(s.card?.secret_key || '')

  const [status, setStatus] = useState('idle')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('saving')

    const result = await updatePaymentSettings({
      paypal: { email: paypalEmail, client_id: paypalClientId, secret: paypalSecret },
      bank: {
        account_name: bankAccountName,
        account_number: bankAccountNumber,
        bank_name: bankName,
        iban: bankIban,
        swift: bankSwift,
      },
      card: {
        processor: cardProcessor,
        publishable_key: cardPublishableKey,
        secret_key: cardSecretKey,
      },
      other: {
        name: otherName,
        details: otherDetails,
      },
    })

    setStatus(result.error ? 'error' : 'saved')
    setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h3 className="font-bold mb-3">PayPal</h3>
        <div className="space-y-3">
          <Field
            label="Receiving email"
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Field
            label="Client ID"
            value={paypalClientId}
            onChange={(e) => setPaypalClientId(e.target.value)}
            placeholder="From developer.paypal.com → Apps & Credentials"
          />
          <Field
            label="Secret"
            type="password"
            value={paypalSecret}
            onChange={(e) => setPaypalSecret(e.target.value)}
          />
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3">Bank account</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Field label="Account holder name" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
          </div>
          <Field label="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
          <Field label="Account number" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
          <Field label="IBAN" value={bankIban} onChange={(e) => setBankIban(e.target.value)} />
          <Field label="SWIFT / BIC" value={bankSwift} onChange={(e) => setBankSwift(e.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3">Other payment gateway</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gateway name" value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="e.g. Wise, Skrill" />
          <Field label="Account or receiving details" value={otherDetails} onChange={(e) => setOtherDetails(e.target.value)} placeholder="Email, account ID, or payment instructions" />
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3">Card</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--a-text-muted)' }}>
          Card payments need a processor account (e.g. Stripe). Keys go here once that account exists — donation pages won&apos;t accept live card payments until then.
        </p>
        <div className="space-y-3">
          <Field label="Processor" value={cardProcessor} onChange={(e) => setCardProcessor(e.target.value)} />
          <Field label="Publishable key" value={cardPublishableKey} onChange={(e) => setCardPublishableKey(e.target.value)} />
          <Field label="Secret key" type="password" value={cardSecretKey} onChange={(e) => setCardSecretKey(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-lg text-sm font-bold px-6 py-2.5 disabled:opacity-60 transition-transform hover:-translate-y-0.5"
          style={{ background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }}
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
        {status === 'saved' && <span className="text-sm font-semibold" style={{ color: 'var(--a-success)' }}>Saved</span>}
        {status === 'error' && <span className="text-sm font-semibold" style={{ color: 'var(--a-danger)' }}>Save failed</span>}
      </div>
    </form>
  )
}
