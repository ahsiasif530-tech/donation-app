'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminPortal from './AdminPortal'

const POLL_MS = 15000
const TOAST_MS = 9000

// A soft two-note chime. Browsers only allow sound after the page has been
// clicked once, so a blocked chime is simply skipped.
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    ;[880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.55)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {}
}

// Checks for newly completed donations every few seconds while the tab is
// open, shows each as a toast with a chime, and refreshes the dashboard's
// numbers. The first check only learns what is already there.
export default function LiveDonations() {
  const router = useRouter()
  const seen = useRef(null)
  const [toasts, setToasts] = useState([])
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)

  useEffect(() => {
    try {
      const m = localStorage.getItem('admin-live-muted') === '1'
      setMuted(m)
      mutedRef.current = m
    } catch {}
  }, [])

  useEffect(() => {
    let stopped = false
    async function check() {
      if (document.hidden) return
      try {
        const res = await fetch('/admin/live', { cache: 'no-store' })
        if (!res.ok) return
        const { latest } = await res.json()
        if (stopped) return
        if (!seen.current) {
          seen.current = new Set(latest.map((d) => d.invoice))
          return
        }
        const fresh = latest.filter((d) => !seen.current.has(d.invoice)).reverse()
        if (fresh.length === 0) return
        fresh.forEach((d) => seen.current.add(d.invoice))
        setToasts((t) => [...t, ...fresh.map((d) => ({ ...d, id: d.invoice }))].slice(-4))
        fresh.forEach((d) => setTimeout(() => setToasts((t) => t.filter((x) => x.id !== d.invoice)), TOAST_MS))
        if (!mutedRef.current) chime()
        router.refresh()
      } catch {}
    }
    check()
    const timer = setInterval(check, POLL_MS)
    const onVisible = () => !document.hidden && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [router])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    mutedRef.current = next
    try {
      localStorage.setItem('admin-live-muted', next ? '1' : '0')
    } catch {}
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleMute}
        title={muted ? 'Sound off for new donations' : 'Sound on for new donations'}
        aria-label={muted ? 'Turn on sound for new donations' : 'Turn off sound for new donations'}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold"
        style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)', color: 'var(--a-text-muted)' }}
      >
        <span className="relative flex w-2 h-2">
          <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: 'var(--a-success)' }} />
          <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: 'var(--a-success)' }} />
        </span>
        Live {muted ? '🔕' : '🔔'}
      </button>

      <AdminPortal>
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(340px,calc(100vw-2rem))]" aria-live="polite">
        {toasts.map((t) => (
          <a
            key={t.id}
            href={`/admin/invoices/${encodeURIComponent(t.invoice)}`}
            className="a-toast flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
            style={{ background: 'var(--a-surface)', border: '1px solid rgba(52,211,153,0.45)' }}
          >
            <span className="text-2xl" aria-hidden="true">🎉</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">
                New gift <span style={{ color: 'var(--a-success)' }}>${t.amount.toFixed(2)}</span>
              </span>
              <span className="block text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>
                {t.donor}
                {t.country ? ` · ${t.country}` : ''}
                {t.page ? ` · ${t.page}` : ''}
              </span>
            </span>
          </a>
        ))}
      </div>
      </AdminPortal>
    </>
  )
}
