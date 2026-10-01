'use client'

import { useEffect, useRef, useState } from 'react'
import { HIDDEN_SECTIONS_COOKIE } from '@/lib/invoiceSections'

// The admin's invoice boxes (one per gateway, plus withdrawals) with a
// "Sections" menu to switch each one on or off. The choice is kept in a cookie
// so the server renders the same boxes on the next visit, without a flash.
export default function InvoiceSections({ sections, initialHidden = [] }) {
  const [hidden, setHidden] = useState(() => new Set(initialHidden))
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  function toggle(key) {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setHidden(next)
    document.cookie = `${HIDDEN_SECTIONS_COOKIE}=${[...next].join(',')}; path=/admin; max-age=31536000; samesite=lax`
  }

  const visible = sections.filter((s) => !hidden.has(s.key))

  return (
    <div>
      <div className="flex justify-end mb-3">
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border px-3.5 py-2 text-sm font-bold hover:opacity-80"
            style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
          >
            Sections ({visible.length}/{sections.length}) ▾
          </button>
          {open && (
            <div
              className="absolute right-0 z-20 mt-2 w-56 rounded-xl border p-2 shadow-lg"
              style={{ background: 'var(--a-surface)', borderColor: 'var(--a-border)' }}
            >
              {sections.map((s) => (
                <label key={s.key} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer hover:opacity-80">
                  <input type="checkbox" checked={!hidden.has(s.key)} onChange={() => toggle(s.key)} />
                  {s.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>
          Shob section off kora. Upore &quot;Sections&quot; theke on koro.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((s) => (
            <div key={s.key} className="min-w-0 grid">
              {s.content}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
