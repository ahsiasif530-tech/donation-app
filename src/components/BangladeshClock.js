'use client'

import { useEffect, useState } from 'react'

// Bangladesh time (Asia/Dhaka, UTC+6, no daylight saving), whatever the
// computer's own clock zone is.
const BD_OFFSET_MS = 6 * 60 * 60 * 1000

function bdParts(now) {
  const d = new Date(now + BD_OFFSET_MS)
  return { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), day: d }
}

const DATE_FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })

// A small live clock: a little round face with moving hands, the digital
// time and the date, all in Bangladesh time.
export default function BangladeshClock() {
  const [now, setNow] = useState(null)
  // The weather where the admin is, as AdminSky reports it.
  const [weather, setWeather] = useState(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    if (window.__adminWeather) setWeather(window.__adminWeather)
    const onWeather = (e) => setWeather(e.detail)
    window.addEventListener('admin-weather', onWeather)
    return () => {
      clearInterval(timer)
      window.removeEventListener('admin-weather', onWeather)
    }
  }, [])

  const t = now == null ? null : bdParts(now)
  const hourDeg = t ? (t.h % 12) * 30 + t.m * 0.5 : 0
  const minDeg = t ? t.m * 6 + t.s * 0.1 : 0
  const secDeg = t ? t.s * 6 : 0
  const hour12 = t ? t.h % 12 || 12 : 0
  const pad = (n) => String(n).padStart(2, '0')

  return (
    <div
      className="inline-flex items-center gap-2.5 rounded-xl pl-2 pr-3 py-1.5"
      style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)' }}
      title="Bangladesh time (Dhaka)"
    >
      <svg width="30" height="30" viewBox="0 0 40 40" aria-hidden="true">
        <circle cx="20" cy="20" r="18" fill="#006A4E" />
        <circle cx="20" cy="20" r="15.5" fill="none" stroke="rgba(255,255,255,0.18)" />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} x1="20" y1="4.5" x2="20" y2={i % 3 === 0 ? 8 : 6.5} stroke="rgba(255,255,255,0.7)" strokeWidth={i % 3 === 0 ? 1.6 : 1} strokeLinecap="round" transform={`rotate(${i * 30} 20 20)`} />
        ))}
        {t && (
          <>
            <line x1="20" y1="20" x2="20" y2="11" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${hourDeg} 20 20)`} />
            <line x1="20" y1="20" x2="20" y2="7.5" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${minDeg} 20 20)`} />
            <line x1="20" y1="23" x2="20" y2="6.5" stroke="#F42A41" strokeWidth="0.9" strokeLinecap="round" transform={`rotate(${secDeg} 20 20)`} />
          </>
        )}
        <circle cx="20" cy="20" r="2" fill="#F42A41" />
      </svg>
      <span className="leading-tight">
        <span className="block text-sm font-bold tabular-nums" style={{ color: 'var(--a-text)' }}>
          {t ? (
            <>
              {hour12}:{pad(t.m)}
              <span style={{ color: 'var(--a-text-muted)' }}>:{pad(t.s)}</span> {t.h < 12 ? 'AM' : 'PM'}
            </>
          ) : (
            '--:--'
          )}
        </span>
        <span className="block text-[11px] font-semibold" style={{ color: 'var(--a-text-muted)' }}>
          🇧🇩 Dhaka{t ? ` · ${DATE_FMT.format(t.day)}` : ''}
          {weather && (
            <span title={`Weather where you are: ${weather.label}`} style={{ color: weather.raining ? '#60A5FA' : 'var(--a-text-muted)' }}>
              {' · '}
              {weather.icon} {weather.temp}°C
            </span>
          )}
        </span>
      </span>
    </div>
  )
}
