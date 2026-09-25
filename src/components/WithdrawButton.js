'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addWithdrawal } from '@/app/admin/actions'

const inputStyle = { background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }

export default function WithdrawButton({ pageId, pageName, available }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function close() {
    setOpen(false)
    setAmount('')
    setNote('')
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const res = await addWithdrawal({ pageId, amount, note })
    setSaving(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    close()
    router.refresh()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-lg border text-xs font-bold px-3.5 py-2 mr-2 hover:opacity-80"
        style={{ borderColor: 'var(--a-danger)', color: 'var(--a-danger)' }}
      >
        Withdraw
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 text-left whitespace-normal"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={close}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="a-card w-full max-w-sm p-6 space-y-4"
          >
            <div>
              <h3 className="font-bold text-lg">Withdraw — {pageName}</h3>
              <p className="text-sm mt-0.5" style={{ color: 'var(--a-text-muted)' }}>
                Available: <span className="font-bold tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>${available.toFixed(2)}</span>
              </p>
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--a-text-muted)' }}>Amount (USD)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={available.toFixed(2)}
                required
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none tabular-nums"
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-sm mb-1.5" style={{ color: 'var(--a-text-muted)' }}>Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. PayPal to bank"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                style={inputStyle}
              />
            </div>

            {error && <p className="text-sm" style={{ color: 'var(--a-danger)' }}>{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border text-sm font-bold px-4 py-2 hover:opacity-80"
                style={{ borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg text-sm font-bold px-4 py-2 disabled:opacity-60"
                style={{ background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }}
              >
                {saving ? 'Saving…' : 'Withdraw'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
