'use client'

import { useState } from 'react'
import { unlockPaymentSettings, createSettingsPassword, changeSettingsPassword } from '@/app/admin/settings/actions'
import PaymentSettingsForm from './PaymentSettingsForm'

const inputClass = 'w-full rounded-lg border px-3 py-2.5 text-sm focus:outline-none'
const inputStyle = { background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }
const buttonStyle = { background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }

function LockIcon() {
  return (
    <div
      className="w-12 h-12 mx-auto rounded-full flex items-center justify-center"
      style={{ background: 'var(--a-surface-2)', color: 'var(--a-accent-strong)' }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    </div>
  )
}

function ChangePassword({ currentPassword, minLength, onChanged }) {
  const [open, setOpen] = useState(false)
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (next !== confirm) {
      setMessage({ error: true, text: 'The two passwords don’t match.' })
      return
    }
    setSaving(true)
    const result = await changeSettingsPassword(currentPassword, next)
    setSaving(false)
    if (result.error) {
      setMessage({ error: true, text: result.error })
      return
    }
    onChanged(next)
    setNext('')
    setConfirm('')
    setMessage({ error: false, text: 'Settings password changed.' })
  }

  return (
    <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--a-border)' }}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-sm font-bold" style={{ color: 'var(--a-accent-strong)' }}>
        {open ? '▾' : '▸'} Change settings password
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3 max-w-sm">
          <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} placeholder={`New password (at least ${minLength} characters)`} className={inputClass} style={inputStyle} />
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type the new password again" className={inputClass} style={inputStyle} />
          {message && <p className="text-sm" style={{ color: message.error ? 'var(--a-danger)' : 'var(--a-success)' }}>{message.text}</p>}
          <button type="submit" disabled={saving || !next || !confirm} className="rounded-lg text-sm font-bold px-5 py-2.5 disabled:opacity-60" style={buttonStyle}>
            {saving ? 'Saving…' : 'Change password'}
          </button>
        </form>
      )}
    </div>
  )
}

// Asks for the settings password every time the page is opened (or, on the
// very first visit, to create one). The settings only reach the browser once
// the server has accepted the password.
export default function PaymentSettingsLock({ hasPassword, minLength }) {
  const creating = !hasPassword
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (creating && password !== confirm) {
      setError('The two passwords don’t match.')
      return
    }
    setChecking(true)
    const result = creating ? await createSettingsPassword(password) : await unlockPaymentSettings(password)
    setChecking(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSettings(result.settings)
  }

  if (settings) {
    return (
      <>
        <PaymentSettingsForm initialSettings={settings} settingsPassword={password} />
        <ChangePassword currentPassword={password} minLength={minLength} onChanged={setPassword} />
      </>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto py-6 space-y-4 text-center">
      <LockIcon />
      <div>
        <h2 className="font-bold">{creating ? 'Create a settings password' : 'Settings are locked'}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--a-text-muted)' }}>
          {creating
            ? `It will be asked every time Payment Settings is opened. Use at least ${minLength} characters, different from your login password.`
            : 'Enter the settings password to continue.'}
        </p>
      </div>
      <input
        type="password"
        autoFocus
        autoComplete={creating ? 'new-password' : 'current-password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={creating ? 'New settings password' : 'Settings password'}
        className={inputClass}
        style={inputStyle}
      />
      {creating && (
        <input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Type it again"
          className={inputClass}
          style={inputStyle}
        />
      )}
      {error && <p className="text-sm" style={{ color: 'var(--a-danger)' }}>{error}</p>}
      <button
        type="submit"
        disabled={checking || !password || (creating && !confirm)}
        className="w-full rounded-lg text-sm font-bold py-2.5 disabled:opacity-60"
        style={buttonStyle}
      >
        {checking ? 'Checking…' : creating ? 'Create password' : 'Unlock'}
      </button>
    </form>
  )
}
