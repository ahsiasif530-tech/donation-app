'use client'

import { useState } from 'react'
import { unlockPaymentSettings } from '@/app/admin/settings/actions'
import PaymentSettingsForm from './PaymentSettingsForm'

// Asks for the settings password every time the page is opened. The settings
// themselves only reach the browser once the server has accepted it.
export default function PaymentSettingsLock() {
  const [password, setPassword] = useState('')
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleUnlock(e) {
    e.preventDefault()
    setChecking(true)
    setError('')
    const result = await unlockPaymentSettings(password)
    setChecking(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSettings(result.settings)
  }

  if (settings) return <PaymentSettingsForm initialSettings={settings} settingsPassword={password} />

  return (
    <form onSubmit={handleUnlock} className="max-w-sm mx-auto py-6 space-y-4 text-center">
      <div
        className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
        style={{ background: 'var(--a-surface-2)', color: 'var(--a-accent-strong)' }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      </div>
      <div>
        <h2 className="font-bold">Settings are locked</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--a-text-muted)' }}>Enter the settings password to continue.</p>
      </div>
      <input
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Settings password"
        className="w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none"
        style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
      />
      {error && <p className="text-sm" style={{ color: 'var(--a-danger)' }}>{error}</p>}
      <button
        type="submit"
        disabled={checking || !password}
        className="w-full rounded-lg text-sm font-bold py-2.5 disabled:opacity-60"
        style={{ background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }}
      >
        {checking ? 'Checking…' : 'Unlock'}
      </button>
    </form>
  )
}
