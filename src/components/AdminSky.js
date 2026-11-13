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

// The moon: where it is in the sky and how much of it is lit. Low-precision
// formulas (a degree or so), plenty for a picture of the sky.
const SYNODIC = 29.530588853
const NEW_MOON_2000 = 947182440000 // 2000-01-06 18:14 UTC

function moonAt(ms, lat, lon) {
  const d = ms / 86400000 - 10957.5
  const L = rad(218.316 + 13.176396 * d)
  const M = rad(134.963 + 13.064993 * d)
  const F = rad(93.272 + 13.22935 * d)
  const l = L + rad(6.289) * Math.sin(M)
  const b = rad(5.128) * Math.sin(F)
  const e = rad(23.4397)
  const ra = deg(Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l)))
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l))
  const gmst = (18.697374558 + 24.06570982441908 * d) * 15
  const ha = (((gmst + lon - ra) % 360) + 540) % 360 - 180
  const elevation = deg(Math.asin(Math.sin(rad(lat)) * Math.sin(dec) + Math.cos(rad(lat)) * Math.cos(dec) * Math.cos(rad(ha))))
  // 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter.
  const phase = ((((ms - NEW_MOON_2000) / 86400000) % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC
  return {
    elevation,
    phase,
    lit: (1 - Math.cos(phase * 2 * Math.PI)) / 2,
    x: 50 + Math.max(-42, Math.min(42, ha / 2.4)),
    y: Math.max(4, Math.min(92, 92 - Math.max(0, elevation) * 1.3)),
  }
}

const skyNow = (lat, lon) => {
  const now = Date.now()
  return { ...skyFor(sunAt(now, lat, lon)), moon: moonAt(now, lat, lon) }
}

// The moon's face: the lit part drawn with the right shape for the phase
// (waxing lit on the right, waning on the left), a few soft craters, and a
// halo of moonlight.
function MoonDisc({ moon }) {
  const r = 20
  const c = 25
  const waxing = moon.phase < 0.5
  const k = Math.cos(moon.phase * 2 * Math.PI)
  const rx = Math.abs(k) * r
  const crescent = k > 0
  const outer = waxing ? 1 : 0
  const inner = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0
  const lit = `M ${c} ${c - r} A ${r} ${r} 0 0 ${outer} ${c} ${c + r} A ${rx} ${r} 0 0 ${inner} ${c} ${c - r} Z`
  return (
    <svg width="100%" height="100%" viewBox="0 0 50 50" style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <radialGradient id="moon-lit" cx="40%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#FFFDF2" />
          <stop offset="100%" stopColor="#E6DEC6" />
        </radialGradient>
        <clipPath id="moon-lit-clip">
          <path d={lit} />
        </clipPath>
      </defs>
      {/* The dark side, just visible (earthshine) */}
      <circle cx={c} cy={c} r={r} fill="rgba(150,162,195,0.2)" stroke="rgba(220,228,255,0.28)" strokeWidth="0.6" />
      {moon.lit > 0.02 && (
        <>
          <path d={lit} fill="url(#moon-lit)" />
          <g clipPath="url(#moon-lit-clip)" fill="rgba(150,140,120,0.22)">
            <circle cx={c - 7} cy={c - 6} r="4" />
            <circle cx={c + 6} cy={c + 4} r="5.5" />
            <circle cx={c - 3} cy={c + 9} r="2.6" />
            <circle cx={c + 9} cy={c - 9} r="2" />
            <circle cx={c - 11} cy={c + 3} r="2.2" />
          </g>
        </>
      )}
    </svg>
  )
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


// Soft floating lights, placed once.
const FLOATERS = Array.from({ length: 14 }, (_, i) => {
  const r = (n) => {
    const x = Math.sin(i * 91.17 + n * 37.71) * 24634.6345
    return x - Math.floor(x)
  }
  return { x: r(1) * 100, y: 10 + r(2) * 90, s: 40 + r(3) * 110, d: 26 + r(4) * 30, o: r(5) * 40 }
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
          setSky(skyNow(next.lat, next.lon))
          loadWeather()
        }
      },
      () => {},
      { maximumAge: 30 * 60 * 1000, timeout: 15000 }
    )

    const tick = () => setSky(skyNow(pos.current.lat, pos.current.lon))
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

  // Scrolling moves the sky in layers, like looking up while walking: far
  // stars barely shift and the whole sky turns a touch, the sunlight rises,
  // clouds and floating lights slide past faster. Written straight into CSS
  // variables so scrolling never re-renders anything.
  const [wrapEl, setWrapEl] = useState(null)

  useEffect(() => {
    const el = wrapEl
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const update = () => {
      raf = 0
      const y = window.scrollY
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      el.style.setProperty('--sy', String(Math.round(y)))
      el.style.setProperty('--sp', (y / max).toFixed(4))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [wrapEl])

  if (!sky) return null
  const clouds = weather?.clouds ?? 0
  const rain = weather?.rain ?? 0
  // Clouds and rain dim the light.
  const glow = sky.glowStrength * (1 - clouds * 0.7)
  const stars = sky.stars * (1 - clouds)
  const night = sky.phase === 'night' && clouds < 0.5

  return (
    <AdminPortal>
      <div ref={setWrapEl} aria-hidden="true" className="a-sky fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: -1, '--sy': 0, '--sp': 0 }} data-phase={sky.phase}>
        {/* The sky itself, a little deeper the further down the page */}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${sky.top}, ${sky.bottom})`, opacity: 0.85, transition: 'background 60s linear' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent, rgba(5,7,15,0.45))', opacity: 'calc(var(--sp) * 0.9)' }} />
        {/* Sunlight: breathes slowly, and rises as you scroll */}
        <div className="a-sky-glow absolute" style={{ inset: '-20%' }}>
          <div
            className="a-glow-breathe absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 58% 50% at ${sky.x}% ${sky.y * 0.7 + 15}%, ${sky.glow}, transparent 70%)`,
              opacity: glow,
              transition: 'opacity 60s linear, background 60s linear',
            }}
          />
        </div>
        {/* Sun rays turning slowly in daylight */}
        {glow > 0.15 && (
          <div className="a-sky-glow absolute" style={{ inset: '-20%' }}>
            <div
              className="a-rays absolute"
              style={{
                left: `${sky.x}%`,
                top: `${sky.y * 0.7 + 15}%`,
                width: '160vmax',
                height: '160vmax',
                marginLeft: '-80vmax',
                marginTop: '-80vmax',
                background: `repeating-conic-gradient(from 0deg, ${sky.glow} 0deg 4deg, transparent 4deg 18deg)`,
                opacity: glow * 0.16,
                maskImage: 'radial-gradient(circle, black 0%, transparent 45%)',
                WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 45%)',
              }}
            />
          </div>
        )}
        {/* Stars: the far layer, the sky turning slightly as you scroll */}
        <div className="a-sky-stars absolute" style={{ inset: '-25%', opacity: stars, transition: 'opacity 60s linear' }}>
          <div className="a-stars-spin absolute inset-0">
            {STARS.map((s, i) => (
              <span
                key={i}
                className="a-star absolute rounded-full bg-white"
                style={{ left: `${20 + s.x * 0.6}%`, top: `${20 + s.y * 0.8}%`, width: s.s, height: s.s, opacity: s.o, animationDelay: `${s.d}s` }}
              />
            ))}
          </div>
        </div>
        {/* The moon, where it really is right now, with today's phase. Bright
            at night, pale in daylight, hidden behind thick cloud. */}
        {sky.moon && sky.moon.elevation > -3 && (
          <div className="a-sky-moon a-moon-pos absolute" style={{ left: `${sky.moon.x}%`, top: `${sky.moon.y}%`, transition: 'left 60s linear, top 60s linear' }}>
            <div
              className="a-moon-float a-moon-size"
              style={{
                opacity:
                  Math.min(1, (sky.moon.elevation + 3) / 6) *
                  (sky.phase === 'night' ? 1 : sky.phase === 'dawn' || sky.phase === 'dusk' ? 0.75 : 0.35) *
                  (1 - clouds * 0.85),
                filter: `drop-shadow(0 0 ${8 + sky.moon.lit * 22}px rgba(255,248,220,${0.25 + sky.moon.lit * 0.45}))`,
                transition: 'opacity 8s',
              }}
            >
              <MoonDisc moon={sky.moon} />
            </div>
          </div>
        )}
        {/* Moonlight softly brightening the sky around it on a clear night */}
        {sky.moon && sky.moon.elevation > 0 && sky.phase === 'night' && (
          <div
            className="a-sky-moon absolute inset-0"
            style={{
              background: `radial-gradient(circle 38vmax at ${sky.moon.x}% ${sky.moon.y}%, rgba(190,205,240,${0.1 * sky.moon.lit * (1 - clouds)}), transparent 70%)`,
            }}
          />
        )}
        {/* A shooting star now and then on a clear night */}
        {night && (
          <>
            <span className="a-shooting absolute" style={{ top: '12%', left: '70%' }} />
            <span className="a-shooting a-shooting-2 absolute" style={{ top: '28%', left: '35%' }} />
          </>
        )}
        {/* Floating lights: soft glowing specks drifting up, the near layer */}
        <div className="a-sky-near absolute" style={{ inset: '-30% 0', opacity: 0.55 * (1 - rain * 0.6) }}>
          {FLOATERS.map((b, i) => (
            <span
              key={i}
              className="a-floater absolute rounded-full"
              style={{
                left: `${b.x}%`,
                top: `${b.y}%`,
                width: b.s,
                height: b.s,
                background: `radial-gradient(circle, ${night ? 'rgba(170,190,255,0.55)' : sky.glow}, transparent 70%)`,
                animationDuration: `${b.d}s`,
                animationDelay: `${-b.o}s`,
              }}
            />
          ))}
        </div>
        {/* Clouds drifting, sliding past faster as you scroll */}
        <div className="a-sky-clouds absolute" style={{ inset: '-20% -30%', opacity: clouds, transition: 'opacity 8s' }}>
          <div className="a-cloud absolute" style={{ top: '10%', left: '-5%', width: '55%', height: '28%' }} />
          <div className="a-cloud a-cloud-slow absolute" style={{ top: '25%', left: '30%', width: '60%', height: '30%' }} />
          <div className="a-cloud absolute" style={{ top: '50%', left: '5%', width: '50%', height: '26%', animationDelay: '-40s' }} />
          <div className="a-cloud a-cloud-slow absolute" style={{ top: '70%', left: '45%', width: '50%', height: '26%', animationDelay: '-80s' }} />
        </div>
        {/* Rain clouds make everything greyer */}
        <div className="absolute inset-0" style={{ background: 'rgba(40,46,58,0.35)', opacity: clouds * (rain > 0 ? 1 : 0.4), transition: 'opacity 8s' }} />
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
