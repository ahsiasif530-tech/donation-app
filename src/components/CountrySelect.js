'use client'

import { useEffect, useRef, useState } from 'react'
import { COUNTRIES } from '@/lib/countries'

export default function CountrySelect({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = COUNTRIES.find((c) => c.name === value) || COUNTRIES.find((c) => c.name === 'United States')

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm text-left focus:outline-none"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
      >
        <img src={`https://flagcdn.com/24x18/${selected.code.toLowerCase()}.png`} alt="" width="22" height="16" className="rounded-[2px] shrink-0" />
        <span className="flex-1">{selected.name}</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--ink-muted)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border shadow-lg"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
        >
          {COUNTRIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                onChange(c.name)
                setOpen(false)
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:opacity-80"
              style={{ background: c.name === selected.name ? 'var(--surface-2)' : 'transparent' }}
            >
              <img src={`https://flagcdn.com/24x18/${c.code.toLowerCase()}.png`} alt="" width="22" height="16" className="rounded-[2px] shrink-0" />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
