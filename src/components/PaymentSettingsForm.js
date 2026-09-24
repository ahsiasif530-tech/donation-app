'use client'

import { useState } from 'react'
import { updatePaymentSettings } from '@/app/admin/settings/actions'
import { getPaypalAccounts, getActivePaypalAccountId, MAX_PAYPAL_ACCOUNTS } from '@/lib/paypalAccounts'

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

const selectStyle = { background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
      style={{ background: checked ? 'var(--a-success)' : 'var(--a-border)' }}
    >
      <span
        className="inline-block h-5 w-5 rounded-full bg-white transition-transform"
        style={{ transform: checked ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

// Several PayPal accounts can be saved; exactly one is switched on and receives
// new donations. Turning one on turns the others off.
function PaypalAccountsEditor({ accounts, setAccounts, activeId, setActiveId }) {
  const [openIds, setOpenIds] = useState(() => accounts.filter((a) => !a.client_id).map((a) => a.id))

  function update(id, field, value) {
    setAccounts((list) => list.map((a) => (a.id === id ? { ...a, [field]: value } : a)))
  }

  function toggleOpen(id) {
    setOpenIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function addAccount() {
    const id = crypto.randomUUID()
    const usedLabels = new Set(accounts.map((a) => a.label))
    let n = accounts.length + 1
    while (usedLabels.has(`PayPal ${n}`)) n++
    setAccounts((list) => [...list, { id, label: `PayPal ${n}`, mode: 'live', email: '', client_id: '', secret: '' }])
    setOpenIds((ids) => [...ids, id])
    if (!activeId) setActiveId(id)
  }

  function removeAccount(account) {
    if (!window.confirm(`Remove "${account.label}"? Its Client ID and Secret will be deleted from settings when you save.`)) return
    setAccounts((list) => list.filter((a) => a.id !== account.id))
    if (activeId === account.id) setActiveId(null)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: 'var(--a-text-muted)' }}>
        Save up to {MAX_PAYPAL_ACCOUNTS} PayPal accounts. Only the one switched on receives new donations. Live mode needs Live
        Client ID/Secret from developer.paypal.com — Sandbox credentials will not work in Live.
      </p>

      {accounts.map((a) => {
        const isActive = a.id === activeId
        const isOpen = openIds.includes(a.id)
        const missingKeys = !a.client_id || !a.secret
        return (
          <div
            key={a.id}
            className="rounded-xl border"
            style={{ borderColor: isActive ? 'var(--a-success)' : 'var(--a-border)', background: 'var(--a-surface-2)' }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Switch
                checked={isActive}
                onChange={(on) => setActiveId(on ? a.id : null)}
                label={`Use ${a.label} for donations`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate">{a.label || 'Untitled account'}</p>
                <p className="text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>
                  {a.email || 'No email'} · {a.mode === 'live' ? 'Live' : 'Sandbox'}
                  {isActive && <span style={{ color: 'var(--a-success)' }}> · Receiving donations</span>}
                </p>
              </div>
              <button type="button" onClick={() => toggleOpen(a.id)} className="text-xs font-bold hover:underline" style={{ color: 'var(--a-text-muted)' }}>
                {isOpen ? 'Close' : 'Edit'}
              </button>
            </div>

            {isActive && missingKeys && (
              <p className="px-4 pb-3 text-xs" style={{ color: 'var(--a-danger)' }}>
                This account needs a Client ID and Secret to take PayPal, card, Apple Pay and Google Pay payments.
              </p>
            )}

            {isOpen && (
              <div className="space-y-3 border-t px-4 py-4" style={{ borderColor: 'var(--a-border)' }}>
                <Field label="Name (only you see this)" value={a.label} onChange={(e) => update(a.id, 'label', e.target.value)} placeholder="e.g. Mithun's PayPal" />
                <div>
                  <label className="block text-sm mb-1.5" style={{ color: 'var(--a-text-muted)' }}>Mode</label>
                  <select
                    value={a.mode}
                    onChange={(e) => update(a.id, 'mode', e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                    style={selectStyle}
                  >
                    <option value="sandbox">Sandbox (test — no real money)</option>
                    <option value="live">Live (real payments)</option>
                  </select>
                </div>
                <Field label="Receiving email" type="email" value={a.email} onChange={(e) => update(a.id, 'email', e.target.value)} placeholder="you@example.com" />
                <Field
                  label="Client ID"
                  value={a.client_id}
                  onChange={(e) => update(a.id, 'client_id', e.target.value.trim())}
                  placeholder="From developer.paypal.com → Apps & Credentials"
                />
                <Field label="Secret" type="password" value={a.secret} onChange={(e) => update(a.id, 'secret', e.target.value.trim())} />
                <button type="button" onClick={() => removeAccount(a)} className="text-xs font-bold hover:underline" style={{ color: 'var(--a-danger)' }}>
                  Remove this account
                </button>
              </div>
            )}
          </div>
        )
      })}

      {accounts.length > 0 && !accounts.some((a) => a.id === activeId) && (
        <p className="text-xs font-semibold" style={{ color: 'var(--a-danger)' }}>
          No PayPal account is switched on — PayPal payments won&apos;t work until you turn one on.
        </p>
      )}

      {accounts.length < MAX_PAYPAL_ACCOUNTS ? (
        <button
          type="button"
          onClick={addAccount}
          className="w-full rounded-xl border border-dashed px-4 py-2.5 text-sm font-bold hover:opacity-80"
          style={{ borderColor: 'var(--a-border)', color: 'var(--a-accent-strong)' }}
        >
          + Add PayPal account ({accounts.length}/{MAX_PAYPAL_ACCOUNTS})
        </button>
      ) : (
        <p className="text-xs text-center" style={{ color: 'var(--a-text-muted)' }}>
          Maximum of {MAX_PAYPAL_ACCOUNTS} accounts reached.
        </p>
      )}
    </div>
  )
}

export default function PaymentSettingsForm({ initialSettings }) {
  const s = initialSettings || {}

  const [paypalEnabled, setPaypalEnabled] = useState(s.paypal?.enabled ?? true)
  const [paypalAccounts, setPaypalAccounts] = useState(() => getPaypalAccounts(s.paypal))
  const [activePaypalId, setActivePaypalId] = useState(() => getActivePaypalAccountId(s.paypal))

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
  const [saveError, setSaveError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()

    if (paypalEnabled && !paypalAccounts.some((a) => a.id === activePaypalId)) {
      setSaveError('Turn on one PayPal account, or untick "Show PayPal" above.')
      setStatus('error')
      return
    }
    setSaveError('')
    setStatus('saving')

    const result = await updatePaymentSettings({
      paypal: { enabled: paypalEnabled, active_account_id: activePaypalId, accounts: paypalAccounts },
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

    setSaveError(result.error ? 'Save failed' : '')
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
        <PaypalAccountsEditor
          accounts={paypalAccounts}
          setAccounts={setPaypalAccounts}
          activeId={activePaypalId}
          setActiveId={setActivePaypalId}
        />
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
          Powered by PayPal&apos;s own Advanced Card Payments using the active PayPal account above — turning this off leaves only PayPal as an option. The fields below are unused placeholders for a future separate processor.
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
          Both ride on the active PayPal account above (as PayPal&apos;s own button widgets), no separate setup needed. Apple Pay only shows up for visitors on Safari/Apple devices, and PayPal requires your live site to be on HTTPS with a verified domain before it will actually appear — leave it off until the site is live on its real domain.
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
        {status === 'error' && <span className="text-sm font-semibold" style={{ color: 'var(--a-danger)' }}>{saveError || 'Save failed'}</span>}
      </div>
    </form>
  )
}
