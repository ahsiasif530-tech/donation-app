'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminPortal from './AdminPortal'

// Admin search: opens with "/" or Ctrl/⌘+K (or the button), searches
// donations and pages as you type, and opens a result with Enter or a click.
export default function CommandSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState({ donations: [], pages: [] })
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0)
    else {
      setQ('')
      setResults({ donations: [], pages: [] })
    }
  }, [open])

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults({ donations: [], pages: [] })
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/admin/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal, cache: 'no-store' })
        if (res.ok) {
          setResults(await res.json())
          setActive(0)
        }
      } catch {}
      setLoading(false)
    }, 220)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [q])

  const items = [
    ...results.pages.map((p) => ({ key: `p-${p.id}`, href: `/admin/pages/${p.id}`, title: p.label, sub: p.title && p.title !== p.label ? p.title : `/donate/${p.slug}`, kind: 'Page' })),
    ...results.donations.map((d) => ({
      key: `d-${d.invoice}`,
      href: `/admin/invoices/${encodeURIComponent(d.invoice)}`,
      title: `${d.donor} · $${d.amount.toFixed(2)}`,
      sub: [d.invoice, d.page, d.email].filter(Boolean).join(' · '),
      kind: d.status,
    })),
  ]

  function go(item) {
    if (!item) return
    setOpen(false)
    router.push(item.href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold"
        style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', color: 'var(--a-text-muted)' }}
        aria-label="Search"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="hidden sm:inline">Search</span>
        <kbd className="hidden sm:inline rounded px-1.5 text-[10px]" style={{ background: 'var(--a-surface-2)', border: '1px solid var(--a-border)' }}>/</kbd>
      </button>

      {open && (
        <AdminPortal>
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" style={{ background: 'rgba(5,6,9,0.6)', backdropFilter: 'blur(4px)' }} onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label="Search"
            className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 border-b" style={{ borderColor: 'var(--a-border)' }}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--a-text-muted)" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActive((a) => Math.min(items.length - 1, a + 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive((a) => Math.max(0, a - 1))
                  } else if (e.key === 'Enter') go(items[active])
                }}
                placeholder="Donor, email, invoice, transaction ID or page…"
                className="flex-1 bg-transparent py-3.5 text-sm focus:outline-none"
                style={{ color: 'var(--a-text)', outline: 'none' }}
              />
              <kbd className="text-[10px] rounded px-1.5 py-0.5" style={{ background: 'var(--a-surface-2)', border: '1px solid var(--a-border)', color: 'var(--a-text-muted)' }}>Esc</kbd>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {q.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-xs" style={{ color: 'var(--a-text-muted)' }}>Type at least 2 letters</p>
              ) : loading && items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs" style={{ color: 'var(--a-text-muted)' }}>Searching…</p>
              ) : items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs" style={{ color: 'var(--a-text-muted)' }}>Nothing found</p>
              ) : (
                items.map((item, i) => (
                  <button
                    key={item.key}
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className="w-full text-left flex items-center gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: i === active ? 'var(--a-surface-2)' : 'transparent' }}
                  >
                    <span
                      className="text-[10px] font-bold uppercase rounded px-1.5 py-0.5 shrink-0 w-[74px] text-center"
                      style={{
                        background: item.kind === 'Page' ? 'rgba(212,175,55,0.15)' : item.kind === 'completed' ? 'rgba(52,211,153,0.14)' : item.kind === 'failed' ? 'rgba(248,113,113,0.14)' : 'var(--a-surface-2)',
                        color: item.kind === 'Page' ? 'var(--a-accent-strong)' : item.kind === 'completed' ? 'var(--a-success)' : item.kind === 'failed' ? 'var(--a-danger)' : 'var(--a-text-muted)',
                      }}
                    >
                      {item.kind}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold truncate">{item.title}</span>
                      <span className="block text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>{item.sub}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        </AdminPortal>
      )}
    </>
  )
}
