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

// Short, soft "pit-pit" notes. Checkout gets two quick pips; a payment gets a
// happy rising three with a little sparkle on top.
const PIPS = {
  start: [
    [1318.5, 0],
    [1318.5, 0.16],
  ],
  paid: [
    [1046.5, 0],
    [1318.5, 0.13],
    [1568, 0.26],
    [2093, 0.42],
  ],
}

function pips(kind) {
  return new Promise((resolve) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return resolve()
      const ctx = new Ctx()
      const notes = PIPS[kind] || PIPS.start
      notes.forEach(([freq, at], i) => {
        const start = ctx.currentTime + at
        const last = i === notes.length - 1 && kind === 'paid'
        const len = last ? 0.5 : 0.11
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.008)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + len)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(start + len + 0.05)
      })
      setTimeout(() => {
        ctx.close()
        resolve()
      }, 1100)
    } catch {
      resolve()
    }
  })
}

// Calm 777 Hz background music: a soft, slowly breathing 777 Hz tone with a
// warm low octave, plus gentle bell notes now and then from a scale built on
// 777 Hz. It fades out while an alert plays and fades back in after.
const CALM_HZ = 777
const CALM_LEVEL = 0.07
const CALM_BELLS = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2].map((r) => CALM_HZ * r)
const calm = { ctx: null, master: null, nodes: [], bellTimer: null, ducked: false }

function calmBell() {
  const { ctx, master } = calm
  if (!ctx || !master) return
  const freq = CALM_BELLS[Math.floor(Math.random() * CALM_BELLS.length)]
  const start = ctx.currentTime + 0.05
  ;[1, 2.003].forEach((mult, i) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * mult
    const peak = i === 0 ? 0.5 : 0.08
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 4.5)
    osc.connect(gain).connect(master)
    osc.start(start)
    osc.stop(start + 4.6)
  })
}

// A soft, mellow piano tuned to 777 Hz (the home note sits an octave lower
// at 388.5 Hz). Each key is a few harmonics through a warm filter, fading
// like a felt piano.
const PIANO_ROOT = CALM_HZ / 2
const PIANO_BEAT_MS = 900
// Slow chord loop: I – vi – IV – V, each as just-tuned ratios of the root.
const PIANO_CHORDS = [
  [1, 5 / 4, 3 / 2, 2],
  [5 / 6, 1, 5 / 4, 5 / 3],
  [2 / 3, 5 / 6, 1, 4 / 3],
  [3 / 4, 15 / 16, 9 / 8, 3 / 2],
]
const PIANO_ORDER = [0, 2, 1, 3, 2, 1, 3, 2]
const PIANO_MELODY = [2, 9 / 4, 5 / 2, 3, 10 / 3]

function pianoKey(freq, velocity = 1, delay = 0, eng = calm, length = 3.2) {
  const { ctx, master } = eng
  if (!ctx || !master) return
  const start = ctx.currentTime + 0.03 + delay
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(2600, start)
  filter.frequency.exponentialRampToValueAtTime(700, start + length)
  filter.connect(master)
  ;[
    [1, 1, 1],
    [2, 0.42, 0.6],
    [3, 0.16, 0.45],
    [4, 0.07, 0.35],
  ].forEach(([mult, level, decay]) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = mult === 1 ? 'triangle' : 'sine'
    osc.frequency.value = freq * mult
    const peak = 0.9 * velocity * level
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.006)
    gain.gain.exponentialRampToValueAtTime(peak * 0.35, start + 0.35 * decay + 0.1)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length * decay + 0.4)
    osc.connect(gain).connect(filter)
    osc.start(start)
    osc.stop(start + length + 0.5)
  })
}

// One beat of the loop: 8 beats per chord, a low note to open each chord,
// gentle broken-chord notes (some left out so it breathes), and now and then
// a high melody note or bell.
function calmPianoStep(step) {
  const beat = step % 8
  const chord = PIANO_CHORDS[Math.floor(step / 8) % PIANO_CHORDS.length]
  if (beat === 0) pianoKey(PIANO_ROOT * chord[0] * 0.5, 0.7)
  if (beat !== 0 && Math.random() < 0.22) return
  pianoKey(PIANO_ROOT * chord[PIANO_ORDER[beat]], beat === 0 ? 0.75 : 0.5 + Math.random() * 0.2)
  if (beat === 4 && Math.random() < 0.5) {
    pianoKey(PIANO_ROOT * PIANO_MELODY[Math.floor(Math.random() * PIANO_MELODY.length)], 0.4, 0.45)
  }
  if (step % 24 === 12) calmBell()
}

function startCalm() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    if (calm.ctx) {
      if (calm.ctx.state === 'suspended') calm.ctx.resume()
      return
    }
    const ctx = new Ctx()
    const master = ctx.createGain()
    master.gain.setValueAtTime(0.0001, ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(CALM_LEVEL, ctx.currentTime + 3)
    master.connect(ctx.destination)
    calm.ctx = ctx
    calm.master = master
    calm.ducked = false

    // Slow "breathing" swell, about one breath every 10 seconds.
    const breath = ctx.createGain()
    breath.gain.value = 0.7
    breath.connect(master)
    const lfo = ctx.createOscillator()
    const lfoDepth = ctx.createGain()
    lfo.frequency.value = 0.1
    lfoDepth.gain.value = 0.3
    lfo.connect(lfoDepth).connect(breath.gain)
    lfo.start()

    // 777 Hz, a hair-detuned twin for a soft shimmer, and a warm low octave.
    const voices = [
      [CALM_HZ, 0.3],
      [CALM_HZ + 0.4, 0.15],
      [CALM_HZ / 2, 0.25],
      [CALM_HZ * 1.5, 0.06],
    ]
    calm.nodes = [lfo]
    voices.forEach(([freq, level]) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.value = level
      osc.connect(gain).connect(breath)
      osc.start()
      calm.nodes.push(osc)
    })

    // Soft piano on top, one gentle note per beat, with a bell now and then.
    let step = 0
    calm.bellTimer = setInterval(() => {
      if (calm.ducked) return
      calmPianoStep(step++)
    }, PIANO_BEAT_MS)
  } catch {}
}

function stopCalm() {
  const { ctx, master } = calm
  clearInterval(calm.bellTimer)
  calm.bellTimer = null
  calm.ctx = null
  calm.master = null
  calm.nodes = []
  if (!ctx) return
  try {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2)
    setTimeout(() => ctx.close(), 1400)
  } catch {
    ctx.close()
  }
}

function duckCalm(down) {
  const { ctx, master } = calm
  if (!ctx || calm.ducked === down) return
  calm.ducked = down
  try {
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now)
    master.gain.exponentialRampToValueAtTime(down ? 0.0001 : CALM_LEVEL, now + (down ? 0.5 : 3))
  } catch {}
}

// ---- Sleep sounds: gentle rain, and a slow sleepy piano. Each is its own
// switch, made in the browser (no files), and dips while an alert plays.

function openEngine(eng, level) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return false
  if (eng.ctx) {
    if (eng.ctx.state === 'suspended') eng.ctx.resume()
    return false
  }
  const ctx = new Ctx()
  const master = ctx.createGain()
  master.gain.setValueAtTime(0.0001, ctx.currentTime)
  master.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 4)
  // A gentle limiter keeps loud moments (thunder) from crackling.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  limiter.ratio.value = 6
  master.connect(limiter).connect(ctx.destination)
  eng.ctx = ctx
  eng.master = master
  eng.ducked = false
  return true
}

function closeEngine(eng) {
  const { ctx, master } = eng
  clearInterval(eng.timer)
  clearTimeout(eng.later)
  ;(eng.timeouts || []).forEach(clearTimeout)
  eng.timeouts = []
  eng.timer = null
  eng.ctx = null
  eng.master = null
  if (!ctx) return
  try {
    master.gain.cancelScheduledValues(ctx.currentTime)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), ctx.currentTime)
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5)
    setTimeout(() => ctx.close(), 1700)
  } catch {
    ctx.close()
  }
}

function duckEngine(eng, down, level) {
  const { ctx, master } = eng
  if (!ctx || eng.ducked === down) return
  eng.ducked = down
  try {
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now)
    master.gain.exponentialRampToValueAtTime(down ? 0.0001 : level, now + (down ? 0.5 : 3))
  } catch {}
}

// A night in a tin hut in the forest, in a storm: rain roaring on the
// roof all around, bright metal drops with a fat ringing drop now and then,
// wind rushing through the trees in gusts, frogs out in the wet, and thunder
// — far off and rolling, or close with a crack. Spread left and right, with a
// little room echo, so it feels like lying inside.
const RAIN_LEVEL = 0.35
const rain = { ctx: null, master: null, timer: null, later: null, ducked: false }

function noiseBuffer(ctx, seconds, brown) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else data[i] = white
  }
  return buffer
}

// A small "room": a soft echo so it sounds like being inside a hut.
function makeRoom(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buffer = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch)
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  const room = ctx.createConvolver()
  room.buffer = buffer
  return room
}

// Sends a sound left/right (-1…1) and, a little, into the room echo.
function routeOut(node, pan = 0, wet = 0) {
  const { ctx, master, room } = rain
  let out = node
  if (ctx.createStereoPanner) {
    const p = ctx.createStereoPanner()
    p.pan.value = Math.max(-1, Math.min(1, pan))
    out.connect(p)
    out = p
  }
  out.connect(master)
  if (wet && room) {
    const w = ctx.createGain()
    w.gain.value = wet
    out.connect(w).connect(room)
  }
  return out
}

function rainLater(fn, ms) {
  if (!rain.ctx) return
  rain.timeouts = [...(rain.timeouts || []).slice(-20), setTimeout(fn, ms)]
}

function loopNoise(ctx, buffer, { type, freq, q = 0.7, level, lfoHz, lfoDepth, sweepHz, sweepDepth, pan = 0, wet = 0 }) {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = freq
  filter.Q.value = q
  const gain = ctx.createGain()
  gain.gain.value = level
  if (lfoHz) {
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = lfoHz
    depth.gain.value = lfoDepth
    lfo.connect(depth).connect(gain.gain)
    lfo.start()
  }
  if (sweepHz) {
    // Slowly moves the filter so the wind "sings" up and down.
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = sweepHz
    depth.gain.value = sweepDepth
    lfo.connect(depth).connect(filter.frequency)
    lfo.start()
  }
  src.connect(filter).connect(gain)
  routeOut(gain, pan, wet)
  src.start(0, Math.random() * buffer.duration)
}

function thunder(close) {
  const { ctx } = rain
  if (!ctx || rain.ducked) return
  const now = ctx.currentTime + 0.05
  const side = Math.random() * 1.4 - 0.7
  if (close) {
    // The crack, right before the boom.
    const crack = ctx.createBufferSource()
    crack.buffer = rain.white
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1100
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.0001, now)
    cg.gain.exponentialRampToValueAtTime(0.55, now + 0.015)
    cg.gain.exponentialRampToValueAtTime(0.08, now + 0.25)
    cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
    crack.connect(hp).connect(cg)
    routeOut(cg, side, 0.6)
    crack.start(now, Math.random() * 2, 1)
  }
  // The rolling rumble: deep noise whose tone sinks as it rolls away.
  const boom = ctx.createBufferSource()
  boom.buffer = rain.thunderNoise
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(close ? 1000 : 420, now)
  lp.frequency.exponentialRampToValueAtTime(70, now + 8)
  const g = ctx.createGain()
  const peak = close ? 1.5 : 0.9
  const rise = close ? 0.1 : 0.8
  g.gain.setValueAtTime(0.0001, now)
  g.gain.exponentialRampToValueAtTime(peak, now + rise)
  let t = now + rise
  for (let i = 0; i < 5; i++) {
    t += 0.4 + Math.random() * 0.9
    g.gain.linearRampToValueAtTime(peak * (0.35 + Math.random() * 0.6) * (1 - i * 0.15), t)
  }
  g.gain.exponentialRampToValueAtTime(0.0001, t + 3.5)
  boom.connect(lp).connect(g)
  routeOut(g, side * 0.6, 0.45)
  boom.start(now)
  boom.stop(t + 3.7)
}

function nextThunder(first) {
  rainLater(
    () => {
      thunder(Math.random() < 0.4)
      nextThunder(false)
    },
    first ? 4000 + Math.random() * 4000 : 12000 + Math.random() * 18000
  )
}

// A gust: wind rushing through the trees from one side to the other, with
// the leaves hissing in it.
function gust() {
  const { ctx } = rain
  if (!ctx || rain.ducked) return
  const now = ctx.currentTime + 0.05
  const len = 4 + Math.random() * 3
  const from = Math.random() < 0.5 ? -0.9 : 0.9
  const env = (gain, peak) => {
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peak, now + len * 0.35)
    gain.gain.linearRampToValueAtTime(peak * 0.7, now + len * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + len)
  }
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  if (pan) {
    pan.pan.setValueAtTime(from, now)
    pan.pan.linearRampToValueAtTime(-from * 0.8, now + len)
  }
  const out = ctx.createGain()
  if (pan) out.connect(pan).connect(rain.master)
  else out.connect(rain.master)

  const rush = ctx.createBufferSource()
  rush.buffer = rain.brown
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.9
  bp.frequency.setValueAtTime(380, now)
  bp.frequency.exponentialRampToValueAtTime(950, now + len * 0.4)
  bp.frequency.exponentialRampToValueAtTime(450, now + len)
  const rg = ctx.createGain()
  env(rg, 1.4)
  rush.connect(bp).connect(rg).connect(out)
  rush.start(now, Math.random() * 3, len + 0.2)

  const leaves = ctx.createBufferSource()
  leaves.buffer = rain.white
  const lf = ctx.createBiquadFilter()
  lf.type = 'bandpass'
  lf.frequency.value = 4200
  lf.Q.value = 0.6
  const lg = ctx.createGain()
  env(lg, 0.09)
  leaves.connect(lf).connect(lg).connect(out)
  leaves.start(now, Math.random() * 2, len + 0.2)
}

function nextGust(first) {
  rainLater(
    () => {
      gust()
      nextGust(false)
    },
    first ? 2500 : 7000 + Math.random() * 9000
  )
}

// Frogs croaking out in the wet forest, near and far.
function frog() {
  const { ctx } = rain
  if (!ctx || rain.ducked) return
  const base = 180 + Math.random() * 220
  const pulses = 3 + Math.floor(Math.random() * 4)
  const gap = 0.07 + Math.random() * 0.05
  const level = 0.025 + Math.random() * 0.035
  const out = ctx.createGain()
  out.gain.value = 1
  routeOut(out, Math.random() * 1.8 - 0.9, 0.35)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 900 + Math.random() * 500
  lp.connect(out)
  for (let i = 0; i < pulses; i++) {
    const at = ctx.currentTime + 0.05 + i * gap
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(base * 1.08, at)
    osc.frequency.exponentialRampToValueAtTime(base, at + 0.05)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(level, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.055)
    osc.connect(g).connect(lp)
    osc.start(at)
    osc.stop(at + 0.07)
  }
}

function nextFrog() {
  rainLater(
    () => {
      if (Math.random() < 0.75) frog()
      nextFrog()
    },
    1800 + Math.random() * 4500
  )
}

function startRain() {
  try {
    if (!openEngine(rain, RAIN_LEVEL)) return
    const { ctx } = rain
    rain.timeouts = []
    const brown = noiseBuffer(ctx, 8, true)
    const white = noiseBuffer(ctx, 4, false)
    rain.brown = brown
    rain.white = white
    rain.thunderNoise = noiseBuffer(ctx, 12, true)
    rain.room = makeRoom(ctx, 1.6, 3)
    const roomOut = ctx.createGain()
    roomOut.gain.value = 0.5
    rain.room.connect(roomOut).connect(rain.master)

    // Rain roaring on the tin, spread across the whole roof.
    loopNoise(ctx, brown, { type: 'lowpass', freq: 2200, level: 0.4, lfoHz: 0.07, lfoDepth: 0.15, pan: -0.5 })
    loopNoise(ctx, brown, { type: 'lowpass', freq: 2400, level: 0.4, lfoHz: 0.06, lfoDepth: 0.15, pan: 0.5 })
    // The bright metallic hiss of the sheets.
    loopNoise(ctx, white, { type: 'bandpass', freq: 5200, q: 0.5, level: 0.045, lfoHz: 0.07, lfoDepth: 0.02, pan: -0.6 })
    loopNoise(ctx, white, { type: 'bandpass', freq: 4600, q: 0.5, level: 0.045, lfoHz: 0.05, lfoDepth: 0.02, pan: 0.6 })
    // The sheets humming low as the rain hammers them.
    loopNoise(ctx, brown, { type: 'bandpass', freq: 240, q: 1.5, level: 0.22, lfoHz: 0.05, lfoDepth: 0.1, wet: 0.2 })
    // Wind in the forest: two moving layers and a faint howl.
    loopNoise(ctx, brown, { type: 'bandpass', freq: 480, q: 0.9, level: 0.75, lfoHz: 0.04, lfoDepth: 0.4, sweepHz: 0.06, sweepDepth: 220, pan: -0.45 })
    loopNoise(ctx, brown, { type: 'bandpass', freq: 680, q: 0.9, level: 0.6, lfoHz: 0.027, lfoDepth: 0.35, sweepHz: 0.045, sweepDepth: 260, pan: 0.45 })
    loopNoise(ctx, white, { type: 'bandpass', freq: 820, q: 14, level: 0.06, lfoHz: 0.05, lfoDepth: 0.045, sweepHz: 0.08, sweepDepth: 280, wet: 0.3 })

    // A metal "tong": a few out-of-tune partials that ring briefly, like a
    // fat drop hitting a tin sheet.
    const tong = (at, base, level, pan) => {
      const out = ctx.createGain()
      routeOut(out, pan, 0.3)
      ;[1, 2.76, 5.4].forEach((mult, i) => {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = base * mult
        const peak = level / (i + 1)
        const ring = 0.35 / (i + 1)
        g.gain.setValueAtTime(0.0001, at)
        g.gain.exponentialRampToValueAtTime(peak, at + 0.003)
        g.gain.exponentialRampToValueAtTime(0.0001, at + ring)
        osc.connect(g).connect(out)
        osc.start(at)
        osc.stop(at + ring + 0.02)
      })
    }

    // Drops on the tin, all over the roof: sharp bright "tak-tik" clicks,
    // with a fat drop now and then that rings the metal and thuds the sheet.
    const tapBuffer = noiseBuffer(ctx, 0.12, false)
    rain.timer = setInterval(() => {
      if (rain.ducked || !rain.ctx) return
      const count = 3 + Math.floor(Math.random() * 5)
      for (let i = 0; i < count; i++) {
        const at = ctx.currentTime + 0.02 + Math.random() * 0.07
        const tap = ctx.createBufferSource()
        tap.buffer = tapBuffer
        const tone = ctx.createBiquadFilter()
        tone.type = 'bandpass'
        tone.frequency.value = 2500 + Math.random() * 4500
        tone.Q.value = 6 + Math.random() * 6
        const g = ctx.createGain()
        const peak = 0.12 + Math.random() * 0.22
        const len = 0.02 + Math.random() * 0.04
        g.gain.setValueAtTime(peak, at)
        g.gain.exponentialRampToValueAtTime(0.0001, at + len)
        tap.connect(tone).connect(g)
        routeOut(g, Math.random() * 1.8 - 0.9, 0.12)
        tap.start(at, Math.random() * 0.05, len + 0.02)
      }
      if (Math.random() < 0.18) {
        const at = ctx.currentTime + 0.02 + Math.random() * 0.07
        const pan = Math.random() * 1.6 - 0.8
        tong(at, 520 + Math.random() * 700, 0.035 + Math.random() * 0.03, pan)
        const thud = ctx.createBufferSource()
        thud.buffer = tapBuffer
        const low = ctx.createBiquadFilter()
        low.type = 'bandpass'
        low.frequency.value = 160 + Math.random() * 90
        low.Q.value = 3
        const tg = ctx.createGain()
        tg.gain.setValueAtTime(0.5, at)
        tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.11)
        thud.connect(low).connect(tg)
        routeOut(tg, pan, 0.2)
        thud.start(at, 0, 0.12)
      }
    }, 70)

    nextGust(true)
    nextFrog()
    nextThunder(true)
  } catch {}
}

// Sleep piano: slower and lower than Calm 777, long soft notes with lots of
// space, drifting through four warm chords.
const SLEEP_LEVEL = 0.09
const SLEEP_BEAT_MS = 1700
const SLEEP_ROOT = 196 // a low, warm G
const SLEEP_CHORDS = [
  [1, 5 / 4, 3 / 2, 15 / 8, 9 / 4],
  [5 / 6, 1, 5 / 4, 3 / 2, 2],
  [2 / 3, 5 / 6, 1, 5 / 4, 5 / 3],
  [3 / 4, 1, 9 / 8, 3 / 2, 15 / 8],
]
const SLEEP_ORDER = [0, 2, 3, 4, 3, 2]
const sleepPiano = { ctx: null, master: null, timer: null, ducked: false }

function startSleepPiano() {
  try {
    if (!openEngine(sleepPiano, SLEEP_LEVEL)) return
    let step = 0
    const play = () => {
      if (sleepPiano.ducked || !sleepPiano.ctx) return
      const beat = step % SLEEP_ORDER.length
      const chord = SLEEP_CHORDS[Math.floor(step / SLEEP_ORDER.length) % SLEEP_CHORDS.length]
      step++
      if (beat === 0) pianoKey(SLEEP_ROOT * chord[0] * 0.5, 0.6, 0, sleepPiano, 6)
      if (beat !== 0 && Math.random() < 0.3) return
      pianoKey(SLEEP_ROOT * chord[SLEEP_ORDER[beat]] * 2, beat === 0 ? 0.55 : 0.35 + Math.random() * 0.15, Math.random() * 0.08, sleepPiano, 5.5)
    }
    setTimeout(play, 600)
    sleepPiano.timer = setInterval(play, SLEEP_BEAT_MS)
  } catch {}
}

// One on/off switch for a background sound, remembered in this browser.
// After a reload, the first click on the page starts it (browsers need one).
function useAmbient(storageKey, start, eng, level, busy, quietUntil, followRain = false) {
  const [on, setOn] = useState(false)
  // True while the sound is on only because it is really raining outside
  // (AdminSky reports the weather); it then stops by itself with the rain.
  const byRain = useRef(false)
  useEffect(() => {
    try {
      setOn(localStorage.getItem(storageKey) === '1')
    } catch {}
  }, [storageKey])
  useEffect(() => {
    if (!followRain) return
    let wasRaining = false
    const onWeather = (e) => {
      const raining = !!e.detail?.raining
      if (raining && !wasRaining) {
        setOn((cur) => {
          if (!cur) byRain.current = true
          return true
        })
      } else if (!raining && wasRaining && byRain.current) {
        byRain.current = false
        setOn(false)
      }
      wasRaining = raining
    }
    if (window.__adminWeather) onWeather({ detail: window.__adminWeather })
    window.addEventListener('admin-weather', onWeather)
    return () => window.removeEventListener('admin-weather', onWeather)
  }, [followRain])
  useEffect(() => {
    if (!on) return
    start()
    const wake = () => start()
    document.addEventListener('pointerdown', wake)
    const timer = setInterval(() => duckEngine(eng, busy.current > 0 || Date.now() < quietUntil.current, level), 400)
    return () => {
      clearInterval(timer)
      document.removeEventListener('pointerdown', wake)
      closeEngine(eng)
    }
  }, [on, start, eng, level, busy, quietUntil])
  const toggle = () => {
    const next = !on
    // Pressing the switch yourself always wins over the weather.
    byRain.current = false
    setOn(next)
    try {
      localStorage.setItem(storageKey, next ? '1' : '0')
    } catch {}
  }
  return [on, toggle, byRain.current]
}

function SoundSwitch({ on, onClick, icon, label, color, tint, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      title={hint}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors"
      style={{
        background: on ? tint : 'var(--a-surface)',
        border: `1px solid ${on ? color : 'var(--a-border)'}`,
        color: on ? color : 'var(--a-text-muted)',
      }}
    >
      <span aria-hidden="true" className={on ? 'animate-pulse' : ''}>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      <span className="relative inline-block w-7 h-4 rounded-full transition-colors" style={{ background: on ? color : 'var(--a-border)' }} aria-hidden="true">
        <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: on ? 14 : 2 }} />
      </span>
    </button>
  )
}

const MODES = [
  { id: 'voice', icon: '🔊', label: 'Voice', hint: 'Chime and spoken announcement' },
  { id: 'beep', icon: '🔔', label: 'Beep', hint: 'Short pit-pit sound only' },
  { id: 'off', icon: '🔇', label: 'Off', hint: 'No sound, pop-ups only' },
]

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
  const [mode, setMode] = useState('voice')
  const modeRef = useRef('voice')

  useEffect(() => {
    try {
      let m = localStorage.getItem('admin-live-sound')
      if (!MODES.some((x) => x.id === m)) m = localStorage.getItem('admin-live-muted') === '1' ? 'off' : 'voice'
      setMode(m)
      modeRef.current = m
    } catch {}
    // Voices load late in some browsers; asking once wakes them up.
    window.speechSynthesis?.getVoices()
  }, [])

  // Calm 777 Hz music: its own on/off, remembered per browser. It fades out
  // while an alert is playing and comes back softly after.
  const [pulse, setPulse] = useState(false)
  const busy = useRef(0)
  const quietUntil = useRef(0)

  useEffect(() => {
    try {
      setPulse(localStorage.getItem('admin-live-calm') === '1')
    } catch {}
  }, [])

  useEffect(() => {
    if (!pulse) return
    startCalm()
    // Browsers only allow sound after a click, so after a reload the first
    // click anywhere on the page starts the music.
    const wake = () => startCalm()
    document.addEventListener('pointerdown', wake)
    const timer = setInterval(() => duckCalm(busy.current > 0 || Date.now() < quietUntil.current), 400)
    return () => {
      clearInterval(timer)
      document.removeEventListener('pointerdown', wake)
      stopCalm()
    }
  }, [pulse])

  function togglePulse() {
    const next = !pulse
    setPulse(next)
    try {
      localStorage.setItem('admin-live-calm', next ? '1' : '0')
    } catch {}
  }

  const [rainOn, toggleRain, rainByWeather] = useAmbient('admin-live-rain', startRain, rain, RAIN_LEVEL, busy, quietUntil, true)
  const [sleepOn, toggleSleep] = useAmbient('admin-live-sleep-piano', startSleepPiano, sleepPiano, SLEEP_LEVEL, busy, quietUntil)

  // "My music": a song the admin picks from their own computer. It plays
  // straight from that file in this browser — nothing is uploaded — loops,
  // and dips while an alert plays. A page reload needs the file picked again.
  const MUSIC_VOLUME = 0.4
  const fileInput = useRef(null)
  const audio = useRef(null)
  const [music, setMusic] = useState(null) // { name, playing }

  function pickMusic(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const old = audio.current
    if (old) {
      old.pause()
      URL.revokeObjectURL(old.src)
    }
    const a = new Audio(URL.createObjectURL(file))
    a.loop = true
    a.volume = MUSIC_VOLUME
    audio.current = a
    a.play().catch(() => {})
    setMusic({ name: file.name.replace(/\.[^.]+$/, ''), playing: true })
  }

  function toggleMusic() {
    const a = audio.current
    if (!a) return fileInput.current?.click()
    if (a.paused) a.play().catch(() => {})
    else a.pause()
    setMusic((m) => m && { ...m, playing: !a.paused })
  }

  function removeMusic() {
    const a = audio.current
    if (a) {
      a.pause()
      URL.revokeObjectURL(a.src)
    }
    audio.current = null
    setMusic(null)
  }

  useEffect(() => {
    if (!music?.playing) return
    const timer = setInterval(() => {
      const a = audio.current
      if (!a) return
      const target = busy.current > 0 || Date.now() < quietUntil.current ? 0 : MUSIC_VOLUME
      // Down fast for an alert, back up gently after.
      const stepSize = target < a.volume ? 0.08 : 0.015
      a.volume = Math.abs(target - a.volume) <= stepSize ? target : a.volume + Math.sign(target - a.volume) * stepSize
    }, 100)
    return () => clearInterval(timer)
  }, [music?.playing])

  useEffect(
    () => () => {
      const a = audio.current
      if (a) {
        a.pause()
        URL.revokeObjectURL(a.src)
      }
    },
    []
  )

  // Runs a sound job in the queue while holding the music back.
  const play = (job) => {
    busy.current += 1
    queue.current = queue.current
      .then(job)
      .catch(() => {})
      .finally(() => {
        busy.current -= 1
        quietUntil.current = Date.now() + 2500
      })
  }

  const announce = (kind, text) => {
    const m = modeRef.current
    if (m === 'off') {
      // Even with sound off, the music dips so the moment stands out.
      quietUntil.current = Date.now() + 5000
      return
    }
    play(async () => {
      if (m === 'beep') return pips(kind)
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
            announce('start', checkoutText(d))
          }
          if (d.status === 'completed' && !paid.current.has(d.invoice)) {
            paid.current.add(d.invoice)
            anyPaid = true
            addToast({ ...d, id: `paid-${d.invoice}`, kind: 'paid' })
            announce('paid', receivedText(d))
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

  function choose(next) {
    setMode(next)
    modeRef.current = next
    if (next !== 'voice') window.speechSynthesis?.cancel()
    try {
      localStorage.setItem('admin-live-sound', next)
    } catch {}
    // Picking a sound plays a quick sample (and lets the browser play sound).
    if (next === 'beep') play(() => pips('paid'))
  }

  // Plays a sample so the admin can hear it (this click also lets the
  // browser play sound from now on).
  function test() {
    const sample = { amount: 25, country: 'United States', page: 'Sagor', pageTitle: 'Royal Grace' }
    play(async () => {
      if (modeRef.current === 'beep') {
        await pips('start')
        await new Promise((r) => setTimeout(r, 500))
        await pips('paid')
        return
      }
      await airportChime()
      await speak(checkoutText(sample))
      await airportChime()
      await speak(receivedText(sample))
    })
  }

  return (
    <>
      <div className="inline-flex items-center rounded-lg overflow-hidden" style={{ background: 'var(--a-surface)', border: '1px solid var(--a-border)' }}>
        <span className="hidden sm:inline-flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 text-xs font-bold" style={{ color: 'var(--a-text-muted)' }} title="New checkouts and payments show up here live">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: 'var(--a-success)' }} />
            <span className="relative inline-flex w-2 h-2 rounded-full" style={{ background: 'var(--a-success)' }} />
          </span>
          Live
        </span>
        <span role="radiogroup" aria-label="Alert sound" className="inline-flex items-center gap-0.5 p-0.5 sm:border-l" style={{ borderColor: 'var(--a-border)' }}>
          {MODES.map((m) => {
            const on = mode === m.id
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose(m.id)}
                title={m.hint}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold transition-colors"
                style={{
                  background: on ? (m.id === 'off' ? 'var(--a-border)' : 'rgba(52,211,153,0.16)') : 'transparent',
                  color: on ? (m.id === 'off' ? 'var(--a-text)' : 'var(--a-success)') : 'var(--a-text-muted)',
                }}
              >
                <span aria-hidden="true">{m.icon}</span>
                <span className="hidden sm:inline">{m.label}</span>
              </button>
            )
          })}
        </span>
        {mode !== 'off' && (
          <button
            type="button"
            onClick={test}
            title="Hear a sample announcement"
            className="hidden sm:inline px-2 py-1.5 text-[11px] font-bold border-l"
            style={{ borderColor: 'var(--a-border)', color: 'var(--a-text-muted)' }}
          >
            ▶ Test
          </button>
        )}
      </div>

      {/* The calm music is its own control, apart from the alert sound. */}
      <button
        type="button"
        role="switch"
        aria-checked={pulse}
        onClick={togglePulse}
        title={pulse ? 'Calm 777 Hz music is playing — click to turn off' : 'Play calm 777 Hz background music'}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors"
        style={{
          background: pulse ? 'rgba(244,114,182,0.12)' : 'var(--a-surface)',
          border: `1px solid ${pulse ? 'rgba(244,114,182,0.45)' : 'var(--a-border)'}`,
          color: pulse ? '#F472B6' : 'var(--a-text-muted)',
        }}
      >
        <span aria-hidden="true" className={pulse ? 'animate-pulse' : ''}>🎵</span>
        <span className="hidden sm:inline">Calm 777</span>
        <span className="relative inline-block w-7 h-4 rounded-full transition-colors" style={{ background: pulse ? '#F472B6' : 'var(--a-border)' }} aria-hidden="true">
          <span className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all" style={{ left: pulse ? 14 : 2 }} />
        </span>
        <span className="hidden sm:inline">{pulse ? 'On' : 'Off'}</span>
      </button>

      {/* Sleep sounds: rain and a slow piano, each its own switch. */}
      <SoundSwitch on={rainOn} onClick={toggleRain} icon="🌧" label={rainByWeather ? "Rain · auto" : "Rain"} color="#60A5FA" tint="rgba(96,165,250,0.12)" hint={rainOn ? (rainByWeather ? 'It is raining where you are, so the rain sound came on by itself — click to turn off' : 'Storm night in a tin hut is on — click to turn off') : 'Lying in a tin hut in the forest: rain, wind, frogs and thunder'} />
      <SoundSwitch on={sleepOn} onClick={toggleSleep} icon="🎹" label="Sleep piano" color="#FBBF24" tint="rgba(251,191,36,0.12)" hint={sleepOn ? 'Sleep piano is on — click to turn off' : 'Play a slow, sleepy piano'} />

      {/* My music: a song from this computer, its own control again. */}
      <input ref={fileInput} type="file" accept="audio/*,video/mp4" className="hidden" onChange={pickMusic} />
      <div
        className="inline-flex items-center rounded-lg overflow-hidden text-xs font-bold transition-colors"
        style={{
          background: music?.playing ? 'rgba(167,139,250,0.12)' : 'var(--a-surface)',
          border: `1px solid ${music?.playing ? 'rgba(167,139,250,0.45)' : 'var(--a-border)'}`,
          color: music?.playing ? '#A78BFA' : 'var(--a-text-muted)',
        }}
      >
        <button
          type="button"
          onClick={toggleMusic}
          title={music ? (music.playing ? `Pause: ${music.name}` : `Play: ${music.name}`) : 'Play a song from this computer (it is not uploaded)'}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5"
        >
          <span aria-hidden="true" className={music?.playing ? 'animate-pulse' : ''}>🎶</span>
          <span className="hidden sm:inline max-w-[9rem] truncate">{music ? music.name : 'My music'}</span>
          {music && <span aria-hidden="true">{music.playing ? '⏸' : '▶'}</span>}
        </button>
        {music && (
          <>
            <button type="button" onClick={() => fileInput.current?.click()} title="Choose another song" className="hidden sm:inline px-2 py-1.5 border-l" style={{ borderColor: 'var(--a-border)' }}>
              📁
            </button>
            <button type="button" onClick={removeMusic} title="Stop and remove the song" className="px-2 py-1.5 border-l" style={{ borderColor: 'var(--a-border)' }}>
              ✕
            </button>
          </>
        )}
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
