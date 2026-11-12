'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Renders overlays (toasts, dialogs) at the admin page's root instead of
// inside the sticky top bar, whose blur would otherwise pin "fixed" children
// to the bar. The root still carries the admin colours.
export default function AdminPortal({ children }) {
  const [target, setTarget] = useState(null)
  useEffect(() => setTarget(document.querySelector('.admin-theme') || document.body), [])
  return target ? createPortal(children, target) : null
}
