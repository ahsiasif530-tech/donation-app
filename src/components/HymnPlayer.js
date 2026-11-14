'use client'

import { useEffect, useRef, useState } from 'react'

// "Amazing Grace" (tune: New Britain, public domain) played softly in the
// browser: piano melody, a choir-like "aah" under it and a far church bell at
// the start of each verse. Nothing is downloaded; it is all made here with Web
// Audio. It only starts when the donor taps the button. When a donation goes
// through, a bell and an "Amen" chord close it.

const BEAT = 0.8 // seconds per beat, slow and gentle

const HZ = {
  G2: 98, D2: 73.42, C3: 130.81,
  G3: 196, B3: 246.94, D3: 146.83, Fs3: 185, A3: 220,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392, A4: 440, B4: 493.88, D5: 587.33,
}

// Melody as [note, beats], 3/4 time, starting with a one-beat pickup.
const MELODY = [
  ['D4', 1],
  ['G4', 2], ['B4', 0.5], ['G4', 0.5], ['B4', 2], ['A4', 1], ['G4', 2], ['E4', 1], ['D4', 2], ['D4', 1],
  ['G4', 2], ['B4', 0.5], ['G4', 0.5], ['B4', 2], ['A4', 1], ['D5', 5], ['B4', 1],
  ['D5', 2], ['B4', 0.5], ['D5', 0.5], ['B4', 2], ['A4', 1], ['G4', 2], ['E4', 1], ['D4', 2], ['D4', 1],
  ['G4', 2], ['B4', 0.5], ['G4', 0.5], ['B4', 2], ['A4', 1], ['G4', 3],
]

const CHORDS = {
  G: { bass: 'G2', notes: ['G3', 'B3', 'D4'] },
  C: { bass: 'C3', notes: ['G3', 'C4', 'E4'] },
  D: { bass: 'D2', notes: ['Fs3', 'A3', 'D4'] },
}
// One chord per bar after the pickup.
const BARS = ['G', 'G', 'C', 'G', 'G', 'D', 'D', 'D', 'G', 'G', 'C', 'G', 'G', 'D', 'G']

const SONG_BEATS = MELODY.reduce((sum, [, b]) => sum + b, 0)
const VOLUME = 0.5

function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function openAudio() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  const ctx = new AC()
  const master = ctx.createGain()
  master.gain.value = 0
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -10
  master.connect(limiter)
  limiter.connect(ctx.destination)
  // A church-sized echo.
  const verb = ctx.createConvolver()
  verb.buffer = impulse(ctx, 4, 2.4)
  const wet = ctx.createGain()
  wet.gain.value = 0.6
  verb.connect(wet)
  wet.connect(master)
  const dry = ctx.createGain()
  dry.gain.value = 0.75
  dry.connect(master)
  const bus = ctx.createGain()
  bus.connect(dry)
  bus.connect(verb)
  return { ctx, master, bus, verb, timer: null }
}

function closeAudio(a, fade = 1.2) {
  if (!a) return
  clearTimeout(a.timer)
  const { ctx, master } = a
  try {
    const now = ctx.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setValueAtTime(master.gain.value, now)
    master.gain.linearRampToValueAtTime(0, now + fade)
  } catch {}
  setTimeout(() => ctx.close().catch(() => {}), fade * 1000 + 200)
}

function piano(a, f, t, beats, vel) {
  const { ctx, bus } = a
  const len = Math.max(1.4, beats * BEAT * 1.7)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vel, t + 0.015)
  g.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.45)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  const soft = ctx.createBiquadFilter()
  soft.type = 'lowpass'
  soft.frequency.value = 2400
  g.connect(soft)
  soft.connect(bus)
  for (const [mult, amp] of [[1, 1], [2, 0.28], [3, 0.09], [4, 0.04]]) {
    const o = ctx.createOscillator()
    o.frequency.value = f * mult
    const p = ctx.createGain()
    p.gain.value = amp
    o.connect(p)
    p.connect(g)
    o.start(t)
    o.stop(t + len + 0.05)
  }
}

// A soft choir "aah": detuned voices, darkened, with a gentle vibrato.
function choir(a, freqs, t, dur, level) {
  const { ctx, bus } = a
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(level, t + 0.6)
  g.gain.setValueAtTime(level, t + Math.max(0.6, dur - 0.2))
  g.gain.linearRampToValueAtTime(0, t + dur + 1.2)
  const dark = ctx.createBiquadFilter()
  dark.type = 'lowpass'
  dark.frequency.value = 1100
  const vowel = ctx.createBiquadFilter()
  vowel.type = 'peaking'
  vowel.frequency.value = 760
  vowel.Q.value = 1.2
  vowel.gain.value = 7
  g.connect(dark)
  dark.connect(vowel)
  vowel.connect(bus)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 4.8
  const depth = ctx.createGain()
  depth.gain.value = 6
  lfo.connect(depth)
  lfo.start(t)
  lfo.stop(t + dur + 1.3)
  for (const f of freqs) {
    for (const cents of [-8, 7]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = cents
      depth.connect(o.detune)
      const v = ctx.createGain()
      v.gain.value = 0.5 / freqs.length
      o.connect(v)
      v.connect(g)
      o.start(t)
      o.stop(t + dur + 1.3)
    }
  }
}

// A far church bell: bell-like (not whole-number) overtones, mostly echo.
function bell(a, f, t, level) {
  const { ctx, bus, verb } = a
  const out = ctx.createGain()
  out.gain.value = 1
  out.connect(verb)
  const near = ctx.createGain()
  near.gain.value = 0.25
  out.connect(near)
  near.connect(bus)
  for (const [mult, amp, decay] of [[0.5, 0.5, 6], [1, 1, 5], [1.19, 0.35, 3], [2.0, 0.45, 3.5], [2.76, 0.25, 2], [5.4, 0.1, 1]]) {
    const o = ctx.createOscillator()
    o.frequency.value = f * mult
    const g = ctx.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(level * amp, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay)
    o.connect(g)
    g.connect(out)
    o.start(t)
    o.stop(t + decay + 0.1)
  }
}

// Schedules one verse from time t0 and returns how long it lasts.
function verse(a, t0) {
  bell(a, HZ.G4, t0, 0.09)
  let t = t0
  for (const [note, beats] of MELODY) {
    piano(a, HZ[note], t, beats, 0.2)
    t += beats * BEAT
  }
  BARS.forEach((name, i) => {
    const at = t0 + (1 + i * 3) * BEAT
    const chord = CHORDS[name]
    piano(a, HZ[chord.bass], at, 3, 0.09)
    choir(a, chord.notes.map((n) => HZ[n]), at, 3 * BEAT, 0.07)
  })
  return SONG_BEATS * BEAT + 1.2
}

function playLoop(a) {
  const run = () => {
    const len = verse(a, a.ctx.currentTime + 0.15)
    a.timer = setTimeout(run, (len + 3.5) * 1000)
  }
  run()
}

// Bell and a plagal "A-men" (C to G), sung by the choir.
function amen(a) {
  const t = a.ctx.currentTime + 0.2
  bell(a, HZ.G4, t, 0.16)
  bell(a, HZ.D4, t + 1.6, 0.1)
  choir(a, [HZ.C3, HZ.G3, HZ.C4, HZ.E4], t + 0.6, 2.2, 0.12)
  piano(a, HZ.C3, t + 0.6, 3, 0.1)
  choir(a, [HZ.G2, HZ.G3, HZ.B3, HZ.D4], t + 2.9, 3.6, 0.12)
  piano(a, HZ.G2, t + 2.9, 4, 0.1)
  piano(a, HZ.B4, t + 2.9, 4, 0.1)
}

export default function HymnPlayer() {
  const [on, setOn] = useState(false)
  const audio = useRef(null)

  const stop = () => {
    closeAudio(audio.current)
    audio.current = null
    setOn(false)
  }

  const start = () => {
    const a = openAudio()
    if (!a) return
    audio.current = a
    a.ctx.resume?.()
    a.master.gain.linearRampToValueAtTime(VOLUME, a.ctx.currentTime + 2.5)
    playLoop(a)
    setOn(true)
  }

  // Closes the sound when the donor leaves the page.
  useEffect(() => () => closeAudio(audio.current, 0.2), [])

  // When the thank-you box appears, the hymn fades and the bell + Amen play.
  useEffect(() => {
    let done = false
    const check = () => {
      if (done || !document.querySelector('[data-donation-done]')) return
      done = true
      observer.disconnect()
      if (audio.current) closeAudio(audio.current, 1.5)
      audio.current = null
      setOn(false)
      setTimeout(() => {
        const a = openAudio()
        if (!a) return
        a.ctx.resume?.()
        a.master.gain.value = VOLUME
        amen(a)
        setTimeout(() => closeAudio(a, 1), 9000)
      }, 900)
    }
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })
    check()
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <style>{`
        @keyframes hymn-glow { 0%,100% { box-shadow: 0 6px 24px -8px rgba(0,0,0,.35), 0 0 0 0 rgba(212,175,55,.45) } 50% { box-shadow: 0 6px 24px -8px rgba(0,0,0,.35), 0 0 0 8px rgba(212,175,55,0) } }
        @keyframes hymn-bar { 0%,100% { transform: scaleY(.35) } 50% { transform: scaleY(1) } }
        .hymn-btn { animation: hymn-glow 2.6s ease-in-out infinite; }
        .hymn-btn[aria-pressed="true"] { animation: none; }
        .hymn-bar { display:inline-block; width:3px; height:12px; border-radius:2px; background: var(--gold-bright, #D4AF37); transform-origin: bottom; animation: hymn-bar 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .hymn-btn, .hymn-bar { animation: none; } }
      `}</style>
      <button
        type="button"
        onClick={on ? stop : start}
        aria-pressed={on}
        className="hymn-btn fixed z-40 bottom-1.5 right-3 sm:bottom-4 sm:right-4 flex items-center gap-2.5 rounded-full border pl-3 pr-4 py-2.5 text-left"
        style={{ background: 'var(--surface, #fff)', borderColor: 'var(--border, #e5e5e5)', color: 'var(--heading, #111)' }}
        title={on ? 'Stop the hymn' : 'Play a soft hymn while you give'}
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full text-base" style={{ background: 'var(--surface-2, #f5f5f5)' }} aria-hidden="true">
          {on ? (
            <span className="flex items-end gap-[2px] h-3">
              <span className="hymn-bar" />
              <span className="hymn-bar" style={{ animationDelay: '-.35s' }} />
              <span className="hymn-bar" style={{ animationDelay: '-.7s' }} />
            </span>
          ) : (
            '✝'
          )}
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-bold">{on ? 'Amazing Grace' : 'Play hymn'}</span>
          <span className="block text-[11px]" style={{ color: 'var(--ink-muted, #666)' }}>{on ? 'Tap to stop' : '🎵 Amazing Grace'}</span>
        </span>
      </button>
    </>
  )
}
