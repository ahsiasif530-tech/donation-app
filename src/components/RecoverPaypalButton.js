'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recoverPaypalPayments } from '@/app/admin/actions'

export default function RecoverPaypalButton() {
  const router = useRouter()
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState(null)

  async function handleClick() {
    setRunning(true)
    setMessage(null)
    const res = await recoverPaypalPayments()
    setRunning(false)

    if (res?.error) {
      setMessage({ tone: 'danger', text: res.error })
      return
    }

    const total = res.recovered.reduce((sum, r) => sum + r.amount, 0)
    const parts = [
      res.recovered.length > 0
        ? `Recovered ${res.recovered.length} ${res.recovered.length === 1 ? 'donation' : 'donations'} ($${total.toFixed(2)}).`
        : `Checked ${res.checked} unfinished ${res.checked === 1 ? 'checkout' : 'checkouts'}; none were approved by the donor.`,
    ]
    if (res.errors > 0) parts.push(`${res.errors} could not be checked.`)
    setMessage({ tone: res.recovered.length > 0 ? 'success' : 'muted', text: parts.join(' ') })
    if (res.recovered.length > 0) router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={running}
        className="text-sm font-bold rounded-lg px-4 py-2 disabled:opacity-60"
        style={{ background: 'var(--a-surface-2)', border: '1px solid var(--a-border)', color: 'var(--a-accent-strong)' }}
        title="Captures PayPal payments that donors approved but whose page closed before the money was taken"
      >
        {running ? 'Checking PayPal…' : 'Check PayPal for unfinished payments'}
      </button>
      {message && (
        <p
          className="text-sm"
          style={{ color: message.tone === 'danger' ? 'var(--a-danger)' : message.tone === 'success' ? 'var(--a-success)' : 'var(--a-text-muted)' }}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
