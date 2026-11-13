'use client'

import { useEffect, useRef, useState } from 'react'
import AdminPortal from './AdminPortal'

// A living sky behind the whole admin: the light follows the real sun where
// the admin is (dawn glow, bright day, fading golden afternoon, dusk, a
// starry night), and the real weather there — clouds, rain, storms with
// lightning, fog. When it really rains, the page also tells the 🌧 Rain sound
// (see LiveDonations) so it can start by itself.

const DHAKA = { lat: 23.81, lon: 90.41 }
const POS_KEY = 'admin-sky-pos'
const WEATHER_MS = 10 * 60 * 1000
const SUN_MS = 60 * 1000

// ---- The sun ------------------------------------------------------------

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

// The sun's height above the horizon (degrees) and whether it is still
// morning, for a place and moment. Standard low-precision solar formulas,
// good to a fraction of a degree.
function sunAt(ms, lat, lon) {
  const d = ms / 86400000 - 10957.5
  const g = rad(357.529 + 0.98560028 * d)
  const q = 280.459 + 0.98564736 * d
  const L = rad(q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g))
  const e = rad(23.439 - 0.00000036 * d)
  const ra = deg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)))
  const dec = Math.asin(Math.sin(e) * Math.sin(L))
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15
  let ha = (((gmst + lon - ra) % 360) + 540) % 360 - 180
  const elevation = deg(Math.asin(Math.sin(rad(lat)) * Math.sin(dec) + Math.cos(rad(lat)) * Math.cos(dec) * Math.cos(rad(ha))))
  return { elevation, morning: ha < 0, hourAngle: ha }
}

// Sky colours by sun height. Each stop: [height, top, bottom, glow, glow
// strength, stars]. Morning and evening differ around sunrise/sunset.
const STOPS_MORNING = [
  [-18, '#04060F', '#070B1A', '#1B2A55', 0.0, 1],
  [-10, '#070B22', '#121A3A', '#3B3F7A', 0.12, 0.8],
  [-4, '#141A3F', '#3A2A55', '#E58BA8', 0.32, 0.35],
  [1, '#1E2A55', '#5A3A5A', '#FFB38A', 0.5, 0.05],
  [8, '#1C3358', '#4A4048', '#FFD39A', 0.42, 0],
  [25, '#16324F', '#1C2A3A', '#FFF2C4', 0.26, 0],
  [60, '#143150', '#18263A', '#FFF8DC', 0.22, 0],
]
const STOPS_EVENING = [
  [-18, '#04060F', '#070B1A', '#1B2A55', 0.0, 1],
  [-10, '#080A22', '#161638', '#4A2F6A', 0.14, 0.8],
  [-4, '#171436', '#43264A', '#C8577A', 0.34, 0.35],
  [1, '#22204A', '#5E3036', '#FF8A4C', 0.55, 0.05],
  [8, '#1F3050', '#523A30', '#FFB45E', 0.45, 0],
  [25, '#16324F', '#1C2A3A', '#FFE3A8', 0.28, 0],
  [60, '#143150', '#18263A', '#FFF8DC', 0.22, 0],
]

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => {
  const A = hex(a)
  const B = hex(b)
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`
}

function skyFor(sun) {
  const stops = sun.morning ? STOPS_MORNING : STOPS_EVENING
  const h = Math.max(stops[0][0], Math.min(stops[stops.length - 1][0], sun.elevation))
  let i = 0
  while (i < stops.length - 2 && h > stops[i + 1][0]) i++
  const [h0, t0, b0, g0, s0, st0] = stops[i]
  const [h1, t1, b1, g1, s1, st1] = stops[i + 1]
  const t = (h - h0) / (h1 - h0 || 1)
  // Where the light comes from: left in the morning, right in the evening,
  // higher up the page as the sun climbs.
  const x = 50 + Math.max(-38, Math.min(38, sun.hourAngle / 2.4))
  const y = Math.max(-10, Math.min(105, 100 - Math.max(-8, sun.elevation) * 1.6))
  return {
    top: mix(t0, t1, t),
    bottom: mix(b0, b1, t),
    glow: mix(g0, g1, t),
    glowStrength: s0 + (s1 - s0) * t,
    stars: st0 + (st1 - st0) * t,
    x,
    y,
    phase: sun.elevation < -6 ? 'night' : sun.elevation < 3 ? (sun.morning ? 'dawn' : 'dusk') : sun.elevation < 15 ? (sun.morning ? 'morning' : 'afternoon') : 'day',
  }
}

// ---- The weather --------------------------------------------------------

// WMO weather codes, as Open-Meteo reports them.
function weatherFor(code, isDay) {
  if (code >= 95) return { kind: 'storm', icon: '⛈', label: 'Thunderstorm', rain: 1, clouds: 1 }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    const heavy = code === 65 || code === 67 || code === 82
    return { kind: 'rain', icon: '🌧', label: heavy ? 'Heavy rain' : 'Rain', rain: heavy ? 0.85 : 0.6, clouds: 0.9 }
  }
  if (code >= 51 && code <= 57) return { kind: 'drizzle', icon: '🌦', label: 'Drizzle', rain: 0.3, clouds: 0.75 }
  if (code >= 71 && code <= 86) return { kind: 'snow', icon: '🌨', label: 'Snow', rain: 0, clouds: 0.8 }
  if (code === 45 || code === 48) return { kind: 'fog', icon: '🌫', label: 'Fog', rain: 0, clouds: 0.5, fog: true }
  if (code === 3) return { kind: 'cloudy', icon: '☁️', label: 'Cloudy', rain: 0, clouds: 0.75 }
  if (code === 2) return { kind: 'partly', icon: isDay ? '⛅' : '☁️', label: 'Partly cloudy', rain: 0, clouds: 0.45 }
  if (code === 1) return { kind: 'mostly-clear', icon: isDay ? '🌤' : '🌙', label: 'Mostly clear', rain: 0, clouds: 0.2 }
  return { kind: 'clear', icon: isDay ? '☀️' : '🌙', label: 'Clear', rain: 0, clouds: 0 }
}

function readPos() {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null')
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) return p
  } catch {}
  return null
}

// ---- Rain on the glass ----------------------------------------------------

function RainCanvas({ amount, storm }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || amount <= 0) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)
    const count = Math.round(60 + amount * 260)
    const wind = storm ? 0.32 : 0.16
    const drops = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      len: 10 + Math.random() * 18,
      speed: 9 + Math.random() * 9,
      alpha: 0.12 + Math.random() * 0.25,
    }))
    const frame = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.lineWidth = 1
      ctx.lineCap = 'round'
      for (const d of drops) {
        ctx.strokeStyle = `rgba(180,200,230,${d.alpha})`
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - d.len * wind, d.y + d.len)
        ctx.stroke()
        d.y += d.speed
        d.x -= d.speed * wind
        if (d.y > h + 20 || d.x < -20) {
          d.y = -20 - Math.random() * 60
          d.x = Math.random() * (w + 100)
        }
      }
      raf = requestAnimationFrame(frame)
    }
    const onVisible = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [amount, storm])
  return <canvas ref={ref} className="absolute inset-0 w-full h-full" style={{ opacity: amount > 0 ? 1 : 0, transition: 'opacity 3s' }} />
}

// Stars, placed once so they do not jump around between renders.
const STARS = Array.from({ length: 90 }, (_, i) => {
  const r = (n) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  return { x: r(1) * 100, y: r(2) * 70, s: 1 + r(3) * 1.8, d: r(4) * 4, o: 0.4 + r(5) * 0.6 }
})

export default function AdminSky() {
  const [sky, setSky] = useState(null)
  const [weather, setWeather] = useState(null)
  const [flash, setFlash] = useState(0)
  const pos = useRef(DHAKA)

  // Where the admin is: the browser's location if allowed (asked once),
  // otherwise the last known spot, otherwise Dhaka.
  useEffect(() => {
    const saved = readPos()
    if (saved) pos.current = saved
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        // About 10 km is plenty for sky and weather, and keeps it vague.
        const next = { lat: Math.round(p.coords.latitude * 10) / 10, lon: Math.round(p.coords.longitude * 10) / 10 }
        const moved = Math.abs(next.lat - pos.current.lat) > 0.05 || Math.abs(next.lon - pos.current.lon) > 0.05
        pos.current = next
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(next))
        } catch {}
        if (moved) {
          setSky(skyFor(sunAt(Date.now(), next.lat, next.lon)))
          loadWeather()
        }
      },
      () => {},
      { maximumAge: 30 * 60 * 1000, timeout: 15000 }
    )

    const tick = () => setSky(skyFor(sunAt(Date.now(), pos.current.lat, pos.current.lon)))
    tick()
    const sunTimer = setInterval(tick, SUN_MS)

    async function loadWeather() {
      try {
        const { lat, lon } = pos.current
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,cloud_cover,is_day&timezone=auto`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const { current } = await res.json()
        if (!current) return
        const w = weatherFor(current.weather_code, current.is_day === 1)
        const info = {
          ...w,
          clouds: Math.max(w.clouds, (current.cloud_cover ?? 0) / 100 * 0.8),
          temp: Math.round(current.temperature_2m),
          raining: w.rain > 0,
        }
        setWeather(info)
        window.__adminWeather = info
        window.dispatchEvent(new CustomEvent('admin-weather', { detail: info }))
      } catch {}
    }
    loadWeather()
    const weatherTimer = setInterval(loadWeather, WEATHER_MS)
    return () => {
      clearInterval(sunTimer)
      clearInterval(weatherTimer)
    }
  }, [])

  // Lightning in a storm: a flash (sometimes a double) every few seconds.
  useEffect(() => {
    if (weather?.kind !== 'storm') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let timer
    const strike = () => {
      setFlash(1)
      setTimeout(() => setFlash(0), 90)
      if (Math.random() < 0.5) {
        setTimeout(() => setFlash(0.7), 200)
        setTimeout(() => setFlash(0), 280)
      }
      timer = setTimeout(strike, 6000 + Math.random() * 14000)
    }
    timer = setTimeout(strike, 2500)
    return () => clearTimeout(timer)
  }, [weather?.kind])

  if (!sky) return null
  const clouds = weather?.clouds ?? 0
  const rain = weather?.rain ?? 0
  // Clouds and rain dim the light.
  const glow = sky.glowStrength * (1 - clouds * 0.7)
  const stars = sky.stars * (1 - clouds)

  return (
    <AdminPortal>
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1 }} data-phase={sky.phase}>
        {/* The sky itself */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${sky.top}, ${sky.bottom})`, opacity: 0.85, transition: 'background 60s linear' }} />
        {/* Sunlight */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 70% 60% at ${sky.x}% ${sky.y}%, ${sky.glow}, transparent 70%)`,
            opacity: glow,
            transition: 'opacity 60s linear, background 60s linear',
          }}
        />
        {/* Stars */}
        <div className="absolute inset-0" style={{ opacity: stars, transition: 'opacity 60s linear' }}>
          {STARS.map((s, i) => (
            <span
              key={i}
              className="a-star absolute rounded-full bg-white"
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDelay: `${s.d}s` }}
            />
          ))}
        </div>
        {/* Clouds drifting */}
        <div className="absolute inset-0" style={{ opacity: clouds, transition: 'opacity 8s' }}>
          <div className="a-cloud absolute" style={{ top: '4%', left: '-30%', width: '70%', height: '32%' }} />
          <div className="a-cloud a-cloud-slow absolute" style={{ top: '18%', left: '20%', width: '80%', height: '36%' }} />
          <div className="a-cloud absolute" style={{ top: '45%', left: '-10%', width: '60%', height: '30%', animationDelay: '-40s' }} />
          {/* Rain clouds make everything greyer */}
          <div className="absolute inset-0" style={{ background: 'rgba(40,46,58,0.35)', opacity: rain > 0 ? 1 : 0.4 }} />
        </div>
        {/* Fog */}
        {weather?.fog && <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(200,210,225,0.18), rgba(200,210,225,0.05) 60%, transparent)' }} />}
        {/* Rain */}
        <RainCanvas amount={rain} storm={weather?.kind === 'storm'} />
        {/* Lightning */}
        <div className="absolute inset-0" style={{ background: 'rgba(220,230,255,0.22)', opacity: flash }} />
      </div>
    </AdminPortal>
  )
}
