'use client'

import { useEffect, useState } from 'react'

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

// The map shows latitudes 84°N to 58°S (no Antarctica), equirectangular.
const W = 600
const TOP = 84
const BOTTOM = -58
const H = Math.round((W * (TOP - BOTTOM)) / 360)
const px = (lon) => ((lon + 180) / 360) * W
const py = (lat) => ((TOP - lat) / (TOP - BOTTOM)) * H

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

// TopoJSON → [{ name, path, center: [lon, lat] }].
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
      const rings = polygons.map((poly) => poly.map(ring))
      const path = rings
        .flat()
        .map((pts) => `M${pts.map(([lon, lat]) => `${px(lon).toFixed(1)},${py(Math.max(BOTTOM, lat)).toFixed(1)}`).join('L')}Z`)
        .join('')
      const largest = rings.map((r) => r[0]).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0]
      return { name: g.properties?.name, path, center: ringCenter(largest) }
    })
}

const money = (n) => `$${n.toFixed(2)}`

// Where the money comes from: countries that gave are filled red (brighter
// for more), each with a red dot sized by its total; the top country's dot
// is the largest and glows. byCountry: [{ country, total, count }], largest
// first, with names already resolved.
export default function WorldMap({ byCountry }) {
  const [countries, setCountries] = useState(null)
  const [failed, setFailed] = useState(false)
  const [hover, setHover] = useState(null)

  useEffect(() => {
    let alive = true
    loadAtlas()
      .then((c) => alive && setCountries(c))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [])

  if (failed) return null

  const max = byCountry[0]?.total || 1
  const byAtlasName = new Map(byCountry.map((c) => [ATLAS_NAME[c.country] || c.country, c]))
  const shapeByName = new Map((countries || []).map((s) => [s.name, s]))
  const dots = byCountry
    .map((c, rank) => {
      const shape = shapeByName.get(ATLAS_NAME[c.country] || c.country) || (c.country === 'North Macedonia' ? shapeByName.get('North Macedonia') : null)
      const center = shape?.center || SMALL_COUNTRIES[c.country]
      if (!center) return null
      const strength = Math.sqrt(c.total / max)
      return { ...c, rank, x: px(center[0]), y: py(center[1]), r: rank === 0 ? 16 : Math.max(3, 12 * strength) }
    })
    .filter(Boolean)
    .reverse()

  return (
    <div className="relative mt-1 rounded-xl overflow-hidden" style={{ background: 'var(--a-surface-2)' }} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="World map of donations by country">
        {!countries && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="var(--a-text-muted)">Loading map…</text>
        )}
        {(countries || []).map((s, i) => {
          const data = byAtlasName.get(s.name)
          const strength = data ? Math.sqrt(data.total / max) : 0
          return (
            <path
              key={i}
              d={s.path}
              fill={data ? `rgba(239, 68, 68, ${0.25 + 0.6 * strength})` : '#2A303B'}
              stroke="#171A21"
              strokeWidth="0.5"
              onMouseEnter={data ? () => setHover({ ...data, x: px(s.center[0]), y: py(s.center[1]) }) : undefined}
            />
          )
        })}
        {countries &&
          dots.map((d) => (
            <g key={d.country} onMouseEnter={() => setHover(d)} style={{ cursor: 'default' }}>
              {d.rank === 0 && <circle className="a-map-pulse" cx={d.x} cy={d.y} r={d.r} fill="#ef4444" />}
              <circle cx={d.x} cy={d.y} r={d.r} fill="#ef4444" fillOpacity={d.rank === 0 ? 0.85 : 0.6} stroke="#fca5a5" strokeWidth={d.rank === 0 ? 2 : 1} />
              {d.rank === 0 && <circle cx={d.x} cy={d.y} r={4} fill="#fff" />}
            </g>
          ))}
      </svg>

      {hover && (
        <div
          className="absolute pointer-events-none rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap"
          style={{
            background: 'var(--a-surface)',
            border: '1px solid var(--a-border)',
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: `translate(${hover.x / W > 0.6 ? 'calc(-100% - 12px)' : '12px'}, -50%)`,
          }}
        >
          <p className="font-bold">{hover.country}</p>
          <p>
            <span className="font-bold tabular-nums">{money(hover.total)}</span>
            <span style={{ color: 'var(--a-text-muted)' }}> · {hover.count} {hover.count === 1 ? 'donor' : 'donors'}</span>
          </p>
        </div>
      )}
    </div>
  )
}
