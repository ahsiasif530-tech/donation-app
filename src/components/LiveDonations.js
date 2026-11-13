'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AdminPortal from './AdminPortal'
import { COUNTRIES } from '@/lib/countries'

const POLL_MS = 8000
const TOAST_MS = 10000

// Calm voices in the order we'd like them, as browsers name them.
const PREFERRED_VOICES = ['Google UK English Female', 'Microsoft Sonia', 'Microsoft Libby', 'Microsoft Hazel', 'Samantha', 'Microsoft Zira', 'Google US English']

const countryName = (c) => (c && /^[A-Z]{2}$/.test(c) ? COUNTRIES.find((x) => x.code === c)?.name || c : c)
const sayAmount = (n) => (Number.isInteger(n) ? `${n} dollars` : `${Math.floor(n)} dollars and ${Math.round((n % 1) * 100)} cents`)
const pageWords = (d) => (d.page ? `${d.page}'s page${d.pageTitle && d.pageTitle !== d.page && !/donation/i.test(d.pageTitle) ? `, ${d.pageTitle}` : ''}` : 'a donation page')

// The airport "ding-dong" before an announcement: four soft bell notes.
function airportChime() {
  return new Promise((resolve) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return resolve()
      const ctx = new Ctx()
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, i) => {
        const start = ctx.currentTime + i * 0.34
        ;[1, 2.01].forEach((mult, h) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.value = freq * mult
          const peak = h === 0 ? 0.16 : 0.04
          gain.gain.setValueAtTime(0.0001, start)
          gain.gain.exponentialRampToValueAtTime(peak, start + 0.015)
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4)
          osc.connect(gain).connect(ctx.destination)
          osc.start(start)
          osc.stop(start + 1.45)
        })
      })
      setTimeout(() => {
        ctx.close()
        resolve()
      }, 1750)
    } catch {
      resolve()
    }
  })
}

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices() || []
  for (const name of PREFERRED_VOICES) {
    const v = voices.find((x) => x.name.startsWith(name))
    if (v) return v
  }
  return voices.find((v) => v.lang === 'en-GB') || voices.find((v) => v.lang?.startsWith('en')) || null
}

function speak(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve()
    const u = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) u.voice = voice
    u.lang = voice?.lang || 'en-GB'
    u.rate = 0.88
    u.pitch = 1
    u.volume = 1
    u.onend = resolve
    u.onerror = resolve
    window.speechSynthesis.speak(u)
    setTimeout(resolve, 15000)
  })
}

const checkoutText = (d) => `Attention please. A donor has started checkout on ${pageWords(d)}, for ${sayAmount(d.amount)}.`
const receivedText = (d) => {
  const from = countryName(d.country)
  return `Ladies and gentlemen, payment received. ${sayAmount(d.amount)}${from ? `, from ${from}` : ''}, on ${pageWords(d)}. Thank you.`
}

// Watches donations every few seconds while the tab is open. A donor
// reaching checkout and a payment coming through each get a toast and, unless
// muted, an airport-style chime and spoken announcement; the dashboard's
// numbers refresh on a payment. The first check only learns what is there.
export default function LiveDonations() {
  const router = useRouter()
  const started = useRef(null)
  const paid = useRef(null)
  const queue = useRef(Promise.resolve())
  const [toasts, setToasts] = useState([])
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)

  useEffect(() => {
    try {
      const m = localStorage.getItem('admin-live-muted') === '1'
      setMuted(m)
      mutedRef.current = m
    } catch {}
    // Voices load late in some browsers; asking once wakes them up.
    window.speechSynthesis?.getVoices()
  }, [])

  const announce = (text) => {
    if (mutedRef.current) return
    queue.current = queue.current.then(async () => {
      await airportChime()
      await speak(text)
    })
  }

  const addToast = (toast) => {
    setToasts((t) => [...t.filter((x) => x.id !== toast.id), toast].slice(-4))
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), TOAST_MS)
  }

  useEffect(() => {
    let stopped = false
    async function check() {
      if (document.hidden) return
      try {
        const res = await fetch('/admin/live', { cache: 'no-store' })
        if (!res.ok) return
        const { latest } = await res.json()
        if (stopped || !Array.isArray(latest)) return
        if (!started.current) {
          started.current = new Set(latest.map((d) => d.invoice))
          paid.current = new Set(latest.filter((d) => d.status === 'completed').map((d) => d.invoice))
          return
        }
        let anyPaid = false
        for (const d of [...latest].reverse()) {
          const isNew = !started.current.has(d.invoice)
          started.current.add(d.invoice)
          // A quick payment can start and finish between two checks: both
          // are still announced, checkout first.
          if (isNew) {
            addToast({ ...d, id: `start-${d.invoice}`, kind: 'start' })
            announce(checkoutText(d))
          }
          if (d.status === 'completed' && !paid.current.has(d.invoice)) {
            paid.current.add(d.invoice)
            anyPaid = true
            addToast({ ...d, id: `paid-${d.invoice}`, kind: 'paid' })
            announce(receivedText(d))
          }
        }
        if (anyPaid) router.refresh()
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    mutedRef.current = next
    if (next) window.speechSynthesis?.cancel()
    try {
      localStorage.setItem('admin-live-muted', next ? '1' : '0')
    } catch {}
  }

  // Plays a sample so the admin can hear it (this click also lets the
  // browser play sound from now on).
  function test() {
    const sample = { amount: 25, country: 'United States', page: 'Sagor', pageTitle: 'Royal Grace' }
    queue.current = queue.current.then(async () => {
      await airportChime()
      await speak(checkoutText(sample))
      await airportChime()
      await speak(receivedText(sample))
    })
  }

  return (
    <>
      <div className="hidden sm:inline-flex items-center rounded-lg overflow-hidden" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)' }}>
        <button
          type="button"
          onClick={toggleMute}
          title={muted ? 'Announcements off — click to turn on' : 'Announcements on — click to turn off'}
          aria-label={muted ? 'Turn on announcements' : 'Turn off announcements'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold"
          style={{ color: 'var(--a-text-muted)' }}
        >
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: 'var(--a-success)' }} />
            <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: 'var(--a-success)' }} />
          </span>
          Live {muted ? '🔕' : '🔊'}
        </button>
        <button
          type="button"
          onClick={test}
          title="Hear a sample announcement"
          className="px-2 py-1.5 text-[11px] font-bold border-l"
          style={{ borderColor: 'var(--a-border)', color: 'var(--a-text-muted)' }}
        >
          ▶ Test
        </button>
      </div>

      <AdminPortal>
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]" aria-live="polite">
          {toasts.map((t) => {
            const isPaid = t.kind === 'paid'
            return (
              <a
                key={t.id}
                href={`/admin/invoices/${encodeURIComponent(t.invoice)}`}
                className="a-toast flex items-center gap-3 rounded-2xl px-4 py-3 shadow-2xl"
                style={{ background: 'var(--a-surface)', border: `1px solid ${isPaid ? 'rgba(52,211,153,0.5)' : 'rgba(251,191,36,0.5)'}` }}
              >
                <span className="text-2xl" aria-hidden="true">{isPaid ? '🎉' : '🛫'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {isPaid ? 'Payment received' : 'Checkout started'}{' '}
                    <span style={{ color: isPaid ? 'var(--a-success)' : '#FBBF24' }}>${t.amount.toFixed(2)}</span>
                  </span>
                  <span className="block text-xs truncate" style={{ color: 'var(--a-text-muted)' }}>
                    {[t.donor, countryName(t.country), t.page && `${t.page}${t.pageTitle && t.pageTitle !== t.page && !/donation/i.test(t.pageTitle) ? ` · ${t.pageTitle}` : ''}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </a>
            )
          })}
        </div>
      </AdminPortal>
    </>
  )
}
