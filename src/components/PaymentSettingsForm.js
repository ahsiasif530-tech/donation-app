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

  const [paypalEnabled, setPaypalEnabled] = useState(s.paypal?.enabled ?? true)
  const [paypalMode, setPaypalMode] = useState(s.paypal?.mode || 'sandbox')
  const [paypalEmail, setPaypalEmail] = useState(s.paypal?.email || '')
  const [paypalClientId, setPaypalClientId] = useState(s.paypal?.client_id || '')
  const [paypalSecret, setPaypalSecret] = useState(s.paypal?.secret || '')

  const [bankEnabled, setBankEnabled] = useState(s.bank?.enabled ?? false)
  const [bankAccountName, setBankAccountName] = useState(s.bank?.account_name || '')
  const [bankAccountNumber, setBankAccountNumber] = useState(s.bank?.account_number || '')
  const [bankName, setBankName] = useState(s.bank?.bank_name || '')
  const [bankIban, setBankIban] = useState(s.bank?.iban || '')
  const [bankSwift, setBankSwift] = useState(s.bank?.swift || '')

  const [otherName, setOtherName] = useState(s.other?.name || s.payoneer?.name || '')
  const [otherDetails, setOtherDetails] = useState(s.other?.details || s.payoneer?.details || '')

  const [cardEnabled, setCardEnabled] = useState(s.card?.enabled ?? true)
  const [cardProcessor, setCardProcessor] = useState(s.card?.processor || 'Stripe')
  const [cardPublishableKey, setCardPublishableKey] = useState(s.card?.publishable_key || '')
  const [cardSecretKey, setCardSecretKey] = useState(s.card?.secret_key || '')

  const [applepayEnabled, setApplepayEnabled] = useState(s.applepay?.enabled ?? false)
  const [googlepayEnabled, setGooglepayEnabled] = useState(s.googlepay?.enabled ?? false)

  const [status, setStatus] = useState('idle')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('saving')

    const result = await updatePaymentSettings({
      paypal: { enabled: paypalEnabled, mode: paypalMode, email: paypalEmail, client_id: paypalClientId, secret: paypalSecret },
      bank: {
        enabled: bankEnabled,
        account_name: bankAccountName,
        account_number: bankAccountNumber,
        bank_name: bankName,
        iban: bankIban,
        swift: bankSwift,
      },
      card: {
        enabled: cardEnabled,
        processor: cardProcessor,
        publishable_key: cardPublishableKey,
        secret_key: cardSecretKey,
      },
      other: {
        name: otherName,
        details: otherDetails,
      },
      applepay: { enabled: applepayEnabled },
      googlepay: { enabled: googlepayEnabled },
    })

    setStatus(result.error ? 'error' : 'saved')
    setTimeout(() => setStatus('idle'), 2000)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h3 className="font-bold mb-3">PayPal</h3>
        <label className="flex items-center gap-2 text-sm font-medium mb-4 cursor-pointer">
          <input type="checkbox" checked={paypalEnabled} onChange={(e) => setPaypalEnabled(e.target.checked)} />
          Show &quot;PayPal&quot; as a payment option on donation pages
        </label>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1.5" style={{ color: 'var(--a-text-muted)' }}>Mode</label>
            <select
              value={paypalMode}
              onChange={(e) => setPaypalMode(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
            >
              <option value="sandbox">Sandbox (test — no real money)</option>
              <option value="live">Live (real payments)</option>
            </select>
            {paypalMode === 'live' && (
              <p className="text-xs mt-1.5" style={{ color: 'var(--a-accent-strong)' }}>
                Live mode needs Live Client ID/Secret from developer.paypal.com (toggle from Sandbox to Live there first) — Sandbox credentials will not work here.
              </p>
            )}
          </div>
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
        <label className="flex items-center gap-2 text-sm font-medium mb-4 cursor-pointer">
          <input type="checkbox" checked={bankEnabled} onChange={(e) => setBankEnabled(e.target.checked)} />
          Show &quot;Bank Transfer&quot; as a payment option on donation pages
        </label>
        <p className="text-xs mb-3" style={{ color: 'var(--a-text-muted)' }}>
          There&apos;s no automatic verification for bank transfers — donors see these details after donating, and the invoice stays &quot;pending&quot; until you manually mark it completed once you receive the transfer.
        </p>
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

        <label className="flex items-center gap-2 text-sm font-medium mb-4 cursor-pointer">
          <input type="checkbox" checked={cardEnabled} onChange={(e) => setCardEnabled(e.target.checked)} />
          Show &quot;Credit or Debit Card&quot; as a payment option on donation pages
        </label>
        <p className="text-xs mb-3" style={{ color: 'var(--a-text-muted)' }}>
          Powered by PayPal&apos;s own Advanced Card Payments using the PayPal Client ID/Secret above — turning this off leaves only PayPal as an option. The fields below are unused placeholders for a future separate processor.
        </p>
        <div className="space-y-3">
          <Field label="Processor" value={cardProcessor} onChange={(e) => setCardProcessor(e.target.value)} />
          <Field label="Publishable key" value={cardPublishableKey} onChange={(e) => setCardPublishableKey(e.target.value)} />
          <Field label="Secret key" type="password" value={cardSecretKey} onChange={(e) => setCardSecretKey(e.target.value)} />
        </div>
      </div>

      <div>
        <h3 className="font-bold mb-3">Express checkout</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--a-text-muted)' }}>
          Both ride on the same PayPal Client ID/Secret above (as PayPal&apos;s own button widgets), no separate setup needed. Apple Pay only shows up for visitors on Safari/Apple devices, and PayPal requires your live site to be on HTTPS with a verified domain before it will actually appear — leave it off until the site is live on its real domain.
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={applepayEnabled} onChange={(e) => setApplepayEnabled(e.target.checked)} />
            Show &quot;Apple Pay&quot; as a payment option on donation pages
          </label>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={googlepayEnabled} onChange={(e) => setGooglepayEnabled(e.target.checked)} />
            Show &quot;Google Pay&quot; as a payment option on donation pages
          </label>
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
