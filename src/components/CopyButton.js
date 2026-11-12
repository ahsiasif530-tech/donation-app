'use client'

import { useState } from 'react'

// Copies text and says so for a moment.
export default function CopyButton({ text, label = 'Copy', className = '', style }) {
  const [done, setDone] = useState(false)
  async function copy(e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      el.remove()
    }
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return (
    <button type="button" onClick={copy} className={className} style={style} title={`Copy ${text}`}>
      {done ? 'Copied ✓' : label}
    </button>
  )
}
