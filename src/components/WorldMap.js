'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

// Country shapes (Natural Earth 1:110m) are loaded once in the browser from
// the world-atlas package on jsDelivr, so the app needs no map dependency.
const ATLAS_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json'
let atlasPromise = null

// Our country names → the atlas's names where they differ.
const ATLAS_NAME = {
  'United States': 'United States of America',
  'Bosnia and Herzegovina': 'Bosnia and Herz.',
  'Central African Republic': 'Central African Rep.',
  'Congo (Congo-Brazzaville)': 'Congo',
  'Democratic Republic of the Congo': 'Dem. Rep. Congo',
  'Dominican Republic': 'Dominican Rep.',
  'Equatorial Guinea': 'Eq. Guinea',
  Eswatini: 'eSwatini',
  'Ivory Coast': "Côte d'Ivoire",
  'North Macedonia': 'Macedonia',
  'Solomon Islands': 'Solomon Is.',
  'South Sudan': 'S. Sudan',
}

// Countries too small for the 1:110m shapes, placed by [longitude, latitude].
const SMALL_COUNTRIES = {
  Singapore: [103.8, 1.35],
  'Hong Kong': [114.2, 22.3],
  Malta: [14.4, 35.9],
  Bahrain: [50.55, 26.05],
  Mauritius: [57.6, -20.3],
  Barbados: [-59.5, 13.2],
  Maldives: [73.2, 3.2],
  Andorra: [1.5, 42.5],
  Monaco: [7.42, 43.74],
  Liechtenstein: [9.55, 47.16],
  'San Marino': [12.45, 43.94],
  Bahamas: [-77.4, 25.03],
  'Trinidad and Tobago': [-61.2, 10.7],
  Grenada: [-61.7, 12.1],
  'Saint Lucia': [-60.98, 13.9],
  Seychelles: [55.45, -4.6],
  Samoa: [-172.1, -13.76],
  Tonga: [-175.2, -21.2],
  Macau: [113.55, 22.2],
}

const RED = '#ef4444'
const MEDAL = ['🥇', '🥈', '🥉']
const MIN_ZOOM = 1
const MAX_ZOOM = 8
const LAND = '#2A303B'
const money = (n) => `$${n.toFixed(2)}`
const rad = Math.PI / 180

function loadAtlas() {
  if (!atlasPromise) {
    atlasPromise = fetch(ATLAS_URL)
      .then((r) => r.json())
      .then(decodeCountries)
      .catch((err) => {
        atlasPromise = null
        throw err
      })
  }
  return atlasPromise
}

// TopoJSON → [{ name, rings: [[[lon, lat], …], …], center: [lon, lat] }].
function decodeCountries(topo) {
  const [sx, sy] = topo.transform.scale
  const [tx, ty] = topo.transform.translate
  const arcs = topo.arcs.map((arc) => {
    let x = 0
    let y = 0
    return arc.map(([dx, dy]) => {
      x += dx
      y += dy
      return [x * sx + tx, y * sy + ty]
    })
  })
  const arcPoints = (i) => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse())
  const ring = (indexes) => indexes.flatMap((i, k) => (k ? arcPoints(i).slice(1) : arcPoints(i)))
  const ringArea = (pts) => {
    let a = 0
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[(i + 1) % pts.length]
      a += x1 * y2 - x2 * y1
    }
    return a / 2
  }
  const ringCenter = (pts) => {
    const a = ringArea(pts) || 1
    let cx = 0
    let cy = 0
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i]
      const [x2, y2] = pts[(i + 1) % pts.length]
      const f = x1 * y2 - x2 * y1
      cx += (x1 + x2) * f
      cy += (y1 + y2) * f
    }
    return [cx / (6 * a), cy / (6 * a)]
  }

  return topo.objects.countries.geometries
    .filter((g) => g.arcs)
    .map((g) => {
      const polygons = g.type === 'Polygon' ? [g.arcs] : g.arcs
      const rings = polygons.flatMap((poly) => poly.map(ring))
      const outers = polygons.map((poly) => ring(poly[0]))
      const largest = outers.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0]
      return { name: g.properties?.name, rings, center: ringCenter(largest) }
    })
}

// The given countries placed on the atlas: fills by atlas name, and one dot
// per country (largest first) with its rank and strength (0..1).
function placeData(byCountry, shapes) {
  const max = byCountry[0]?.total || 1
  const fills = new Map(byCountry.map((c) => [ATLAS_NAME[c.country] || c.country, c]))
  const shapeByName = new Map(shapes.map((s) => [s.name, s]))
  const dots = byCountry
    .map((c, rank) => {
      const shape = shapeByName.get(ATLAS_NAME[c.country] || c.country) || shapeByName.get(c.country)
      const center = shape?.center || SMALL_COUNTRIES[c.country]
      return center ? { ...c, rank, center, strength: Math.sqrt(c.total / max) } : null
    })
    .filter(Boolean)
  const grand = byCountry.reduce((sum, c) => sum + c.total, 0)
  return { fills, dots, max, grand }
}

const fillFor = (data, max) => (data ? `rgba(239, 68, 68, ${0.25 + 0.6 * Math.sqrt(data.total / max)})` : LAND)
const dotRadius = (d) => (d.rank === 0 ? 16 : Math.max(3, 12 * d.strength))

function Tooltip({ hover, width, height }) {
  if (!hover) return null
  return (
    <div
      className="absolute pointer-events-none rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap z-10"
      style={{
        background: 'var(--a-surface)',
        border: '1px solid var(--a-border)',
        left: `${(hover.x / width) * 100}%`,
        top: `${(hover.y / height) * 100}%`,
        transform: `translate(${hover.x / width > 0.6 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
      }}
    >
      <p className="font-bold">{hover.country}</p>
      <p>
        <span className="font-bold tabular-nums">{money(hover.total)}</span>
        <span style={{ color: 'var(--a-text-muted)' }}> · {hover.count} {hover.count === 1 ? 'donor' : 'donors'}</span>
      </p>
    </div>
  )
}

// ---- Flat map: latitudes 84°N to 58°S, equirectangular.
const FW = 600
const TOP = 84
const BOTTOM = -58
const FH = Math.round((FW * (TOP - BOTTOM)) / 360)
const fx = (lon) => ((lon + 180) / 360) * FW
const fy = (lat) => ((TOP - Math.max(BOTTOM, lat)) / (TOP - BOTTOM)) * FH

function FlatMap({ shapes, placed }) {
  const [hover, setHover] = useState(null)
  return (
    <div className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${FW} ${FH}`} className="w-full h-auto block" role="img" aria-label="World map of donations by country">
        {shapes.map((s, i) => {
          const data = placed.fills.get(s.name)
          const d = s.rings.map((pts) => `M${pts.map(([lon, lat]) => `${fx(lon).toFixed(1)},${fy(lat).toFixed(1)}`).join('L')}Z`).join('')
          return (
            <path
              key={i}
              d={d}
              fill={fillFor(data, placed.max)}
              stroke="#171A21"
              strokeWidth="0.5"
              onMouseEnter={data ? () => setHover({ ...data, x: fx(s.center[0]), y: fy(s.center[1]) }) : undefined}
            />
          )
        })}
        {[...placed.dots].reverse().map((d) => {
          const x = fx(d.center[0])
          const y = fy(d.center[1])
          const r = dotRadius(d)
          return (
            <g key={d.country} onMouseEnter={() => setHover({ ...d, x, y })}>
              {d.rank === 0 && <circle className="a-map-pulse" cx={x} cy={y} r={r} fill={RED} />}
              <circle cx={x} cy={y} r={r} fill={RED} fillOpacity={d.rank === 0 ? 0.85 : 0.6} stroke="#fca5a5" strokeWidth={d.rank === 0 ? 2 : 1} />
              {d.rank === 0 && <circle cx={x} cy={y} r={4} fill="#fff" />}
            </g>
          )
        })}
        {placed.dots.slice(0, 3).map((d) => {
          const x = fx(d.center[0])
          const y = fy(d.center[1])
          const share = placed.grand > 0 ? (d.total / placed.grand) * 100 : 0
          const left = x > FW * 0.7
          return (
            <text key={`label-${d.country}`} x={left ? x - dotRadius(d) - 5 : x + dotRadius(d) + 5} y={y + 4} textAnchor={left ? 'end' : 'start'} fontSize="12" fontWeight="700" fill="#F2F4F7" stroke="#0F1115" strokeWidth="3" paintOrder="stroke">
              {MEDAL[d.rank]} {d.country} {share < 1 ? '<1' : Math.round(share)}%
            </text>
          )
        })}
      </svg>
      <Tooltip hover={hover} width={FW} height={FH} />
    </div>
  )
}

// ---- Globe: orthographic projection on a canvas, dragged to turn and
// slowly turning on its own. Points behind the horizon are pulled onto the
// edge so country fills stay closed.
function Globe({ shapes, placed }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const state = useRef({ lon: 0, lat: 20, zoom: 1, drag: null, pinch: null, pointers: new Map(), lastMove: 0, hitPaths: [], dotsOnScreen: [], centered: false })
  const [size, setSize] = useState(320)
  const [hover, setHover] = useState(null)
  const [zoomShown, setZoomShown] = useState(1)

  // Start (once) with the top country facing the viewer.
  useEffect(() => {
    const top = placed.dots[0]
    if (top && !state.current.centered) {
      state.current.centered = true
      state.current.lon = top.center[0]
      state.current.lat = Math.max(-40, Math.min(40, top.center[1]))
    }
  }, [placed])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setSize(Math.min(420, Math.max(200, Math.floor(entry.contentRect.width)))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const R0 = size / 2 - 10
    let R = R0
    const cx = size / 2
    const cy = size / 2
    let frame
    let last = performance.now()

    const project = (lon, lat) => {
      const s = state.current
      const l = (lon - s.lon) * rad
      const p = lat * rad
      const p0 = s.lat * rad
      const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l)
      let x = Math.cos(p) * Math.sin(l)
      let y = Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)
      if (cosc < 0) {
        const len = Math.hypot(x, y) || 1
        x /= len
        y /= len
      }
      return [cx + x * R, cy - y * R, cosc >= 0, cosc]
    }

    // A label in a dark pill, moved to the first spot that doesn't overlap
    // a label already drawn.
    const placedBoxes = []
    const drawLabel = (x, y, r, lines, strong) => {
      ctx.font = `${strong ? 700 : 600} 11px ui-sans-serif, system-ui, sans-serif`
      const w = Math.max(...lines.map((t) => ctx.measureText(t).width)) + 12
      const h = lines.length * 13 + 6
      const spots = [
        [x + r + 6, y - h / 2],
        [x - r - 6 - w, y - h / 2],
        [x - w / 2, y + r + 6],
        [x - w / 2, y - r - 6 - h],
      ]
      const fits = ([bx, by]) =>
        bx >= 2 && by >= 2 && bx + w <= size - 2 && by + h <= size - 2 &&
        !placedBoxes.some((b) => bx < b.x + b.w && bx + w > b.x && by < b.y + b.h && by + h > b.y)
      const spot = spots.find(fits) || (strong ? spots[0] : null)
      if (!spot) return
      const [bx, by] = spot
      placedBoxes.push({ x: bx, y: by, w, h })
      ctx.fillStyle = 'rgba(15,17,21,0.88)'
      ctx.strokeStyle = strong ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(bx, by, w, h, 6)
      ctx.fill()
      ctx.stroke()
      lines.forEach((t, i) => {
        ctx.fillStyle = i === 0 ? '#F2F4F7' : '#FCA5A5'
        ctx.font = `${i === 0 ? 700 : 600} 11px ui-sans-serif, system-ui, sans-serif`
        ctx.fillText(t, bx + 6, by + 14 + i * 13)
      })
    }

    const draw = (now) => {
      const s = state.current
      const dt = Math.min(64, now - last)
      last = now
      R = R0 * s.zoom
      if (!s.drag && !reduceMotion && now - s.lastMove > 2500) s.lon += (dt * 0.006) / s.zoom

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size, size)

      // Atmosphere glow and ocean.
      const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.1)
      glow.addColorStop(0, 'rgba(239,68,68,0.10)')
      glow.addColorStop(1, 'rgba(239,68,68,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(cx, cy, R * 1.1, 0, Math.PI * 2)
      ctx.fill()
      const ocean = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R)
      ocean.addColorStop(0, '#1C2433')
      ocean.addColorStop(1, '#10151E')
      ctx.fillStyle = ocean
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.fill()

      // Graticule every 30°.
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath()
        let pen = false
        for (let lat = -90; lat <= 90; lat += 5) {
          const [x, y, vis] = project(lon, lat)
          if (vis) {
            pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
            pen = true
          } else pen = false
        }
        ctx.stroke()
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath()
        let pen = false
        for (let lon = -180; lon <= 180; lon += 5) {
          const [x, y, vis] = project(lon, lat)
          if (vis) {
            pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y)
            pen = true
          } else pen = false
        }
        ctx.stroke()
      }

      // Countries.
      const hitPaths = []
      ctx.lineWidth = 0.5
      ctx.strokeStyle = '#0F1115'
      for (const shape of shapes) {
        // Antarctica's ring runs round the pole and can't be closed this way.
        if (shape.name === 'Antarctica') continue
        const data = placed.fills.get(shape.name)
        const path = new Path2D()
        let any = false
        for (const pts of shape.rings) {
          const projected = pts.map(([lon, lat]) => project(lon, lat))
          if (!projected.some((p) => p[2])) continue
          any = true
          projected.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
          path.closePath()
        }
        if (!any) continue
        ctx.fillStyle = fillFor(data, placed.max)
        ctx.fill(path)
        ctx.stroke(path)
        if (data) hitPaths.push({ path, data, center: shape.center })
      }

      // Dots, smallest last on top; the top country pulses.
      const scale = (R0 / 150) * Math.sqrt(s.zoom)
      const dotsOnScreen = []
      for (const d of [...placed.dots].reverse()) {
        const [x, y, vis] = project(d.center[0], d.center[1])
        if (!vis) continue
        const r = dotRadius(d) * scale
        if (d.rank === 0 && !reduceMotion) {
          const t = (now % 1800) / 1800
          ctx.fillStyle = `rgba(239,68,68,${0.6 * (1 - t)})`
          ctx.beginPath()
          ctx.arc(x, y, r * (1 + 1.6 * t), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.shadowColor = RED
        ctx.shadowBlur = d.rank === 0 ? 18 : 6
        ctx.fillStyle = d.rank === 0 ? 'rgba(239,68,68,0.9)' : 'rgba(239,68,68,0.65)'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.strokeStyle = '#fca5a5'
        ctx.lineWidth = d.rank === 0 ? 2 : 1
        ctx.stroke()
        if (d.rank === 0) {
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(x, y, 3.5 * scale, 0, Math.PI * 2)
          ctx.fill()
        }
        dotsOnScreen.push({ ...d, x, y, r })
      }

      // Labels: the top three always; other giving countries once zoomed in
      // (2×); every country's name, faintly, when zoomed further (3×).
      placedBoxes.length = 0
      const pct = (d) => {
        const share = placed.grand > 0 ? (d.total / placed.grand) * 100 : 0
        return share > 0 && share < 1 ? '<1%' : `${Math.round(share)}%`
      }
      const usd = (n) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
      const byRank = [...dotsOnScreen].sort((a, b) => a.rank - b.rank)
      for (const d of byRank) {
        if (d.rank < 3) drawLabel(d.x, d.y, d.r, [`${MEDAL[d.rank]} ${d.country}`, `${pct(d)} · ${usd(d.total)}`], true)
      }
      if (s.zoom >= 2) {
        for (const d of byRank) {
          if (d.rank >= 3) drawLabel(d.x, d.y, d.r, [d.country, `${pct(d)} · ${usd(d.total)}`], false)
        }
      }
      if (s.zoom >= 3) {
        const giving = new Set(placed.dots.map((d) => ATLAS_NAME[d.country] || d.country))
        ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif'
        ctx.textAlign = 'center'
        for (const shape of shapes) {
          if (!shape.name || giving.has(shape.name) || shape.name === 'Antarctica') continue
          const [x, y, , cosc] = project(shape.center[0], shape.center[1])
          if (cosc < 0.25 || x < 0 || x > size || y < 0 || y > size) continue
          ctx.fillStyle = 'rgba(242,244,247,0.55)'
          ctx.fillText(shape.name, x, y + 3)
        }
        ctx.textAlign = 'start'
      }

      // Rim light.
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(cx, cy, R, 0, Math.PI * 2)
      ctx.stroke()

      s.hitPaths = hitPaths
      s.dotsOnScreen = dotsOnScreen
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [size, shapes, placed])

  const pointFrom = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  const setZoom = (z) => {
    state.current.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
    state.current.lastMove = performance.now()
    setZoomShown(state.current.zoom)
  }

  // Mouse wheel zooms; the listener is added by hand so it can stop the
  // page from scrolling at the same time.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e) => {
      e.preventDefault()
      setZoom(state.current.zoom * Math.exp(-e.deltaY * 0.0015))
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e) => {
    const s = state.current
    canvasRef.current.setPointerCapture(e.pointerId)
    s.pointers.set(e.pointerId, [e.clientX, e.clientY])
    if (s.pointers.size === 2) {
      const [a, b] = [...s.pointers.values()]
      s.pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), zoom: s.zoom }
      s.drag = null
    } else {
      s.drag = { x: e.clientX, y: e.clientY, lon: s.lon, lat: s.lat }
    }
    setHover(null)
  }
  const onPointerMove = (e) => {
    const s = state.current
    s.lastMove = performance.now()
    if (s.pointers.has(e.pointerId)) s.pointers.set(e.pointerId, [e.clientX, e.clientY])
    if (s.pinch && s.pointers.size === 2) {
      const [a, b] = [...s.pointers.values()]
      setZoom((s.pinch.zoom * Math.hypot(a[0] - b[0], a[1] - b[1])) / (s.pinch.dist || 1))
      return
    }
    if (s.drag) {
      const k = 180 / (size * 0.9 * s.zoom)
      s.lon = s.drag.lon - (e.clientX - s.drag.x) * k
      s.lat = Math.max(-70, Math.min(70, s.drag.lat + (e.clientY - s.drag.y) * k))
      return
    }
    const [x, y] = pointFrom(e)
    const dot = s.dotsOnScreen.find((d) => Math.hypot(d.x - x, d.y - y) <= d.r + 4)
    if (dot) return setHover({ ...dot, x, y })
    // Paths are in CSS pixels drawn under a devicePixelRatio transform, and
    // isPointInPath takes canvas pixels.
    const ctx = canvasRef.current.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const hit = s.hitPaths.find((h) => ctx.isPointInPath(h.path, x * dpr, y * dpr))
    setHover(hit ? { ...hit.data, x, y } : null)
  }
  const onPointerUp = (e) => {
    const s = state.current
    s.pointers.delete(e.pointerId)
    if (s.pointers.size < 2) s.pinch = null
    const rest = [...s.pointers.values()][0]
    s.drag = rest ? { x: rest[0], y: rest[1], lon: s.lon, lat: s.lat } : null
    s.lastMove = performance.now()
  }

  const zoomButton = { background: 'rgba(15,17,21,0.85)', border: '1px solid var(--a-border)', color: 'var(--a-text)' }

  return (
    <div ref={wrapRef} className="relative" onMouseLeave={() => setHover(null)}>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, touchAction: 'none', cursor: 'grab', display: 'block', margin: '0 auto' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label="Globe of donations by country; drag to turn it, scroll or pinch to zoom"
      />
      <div className="absolute right-1 bottom-1 flex flex-col gap-1">
        <button type="button" aria-label="Zoom in" className="w-7 h-7 rounded-lg text-sm font-bold" style={zoomButton} onClick={() => setZoom(state.current.zoom * 1.5)}>+</button>
        <button type="button" aria-label="Zoom out" className="w-7 h-7 rounded-lg text-sm font-bold" style={zoomButton} onClick={() => setZoom(state.current.zoom / 1.5)}>−</button>
        {zoomShown > 1 && (
          <button type="button" aria-label="Reset zoom" className="w-7 h-7 rounded-lg text-xs font-bold" style={zoomButton} onClick={() => setZoom(1)}>⟲</button>
        )}
      </div>
      {zoomShown < 2 && (
        <p className="absolute left-1 bottom-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(15,17,21,0.7)', color: 'var(--a-text-muted)' }}>
          Zoom in to see every country
        </p>
      )}
      <Tooltip hover={hover} width={size} height={size} />
    </div>
  )
}

// Where the money comes from, as a turnable globe or a flat map. Countries
// that gave are filled red (brighter for more), each with a red dot sized by
// its total; the top country's dot is the largest and pulses.
// byCountry: [{ country, total, count }], largest first, names resolved.
export default function WorldMap({ byCountry }) {
  const [shapes, setShapes] = useState(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState('globe')

  useEffect(() => {
    let alive = true
    loadAtlas()
      .then((c) => alive && setShapes(c))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  const placed = useMemo(() => (shapes ? placeData(byCountry, shapes) : null), [shapes, byCountry])

  if (failed) return null

  return (
    <div className="mt-1 rounded-xl overflow-hidden p-2" style={{ background: 'var(--a-surface-2)' }}>
      <div className="flex items-center justify-between mb-1 px-1">
        <span className="text-[10px]" style={{ color: 'var(--a-text-muted)' }}>{view === 'globe' ? 'Drag to turn · scroll or pinch to zoom' : ''}</span>
        <div className="a-nav inline-flex" style={{ padding: 2 }}>
          {['globe', 'flat'].map((v) => (
            <a
              key={v}
              href="#"
              aria-current={view === v ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault()
                setView(v)
              }}
              style={{ fontSize: '0.7rem', padding: '3px 9px' }}
            >
              {v === 'globe' ? 'Globe' : 'Flat'}
            </a>
          ))}
        </div>
      </div>
      {!shapes || !placed ? (
        <p className="text-xs text-center py-16" style={{ color: 'var(--a-text-muted)' }}>Loading map…</p>
      ) : view === 'globe' ? (
        <Globe shapes={shapes} placed={placed} />
      ) : (
        <FlatMap shapes={shapes} placed={placed} />
      )}
    </div>
  )
}
