'use client'

import { useEffect } from 'react'

// Shown only when a donation page can't be read at all (the database didn't
// answer twice in a row) and no earlier copy of it was cached. The page's
// language isn't known here, so it speaks both.
export default function DonatePageError({ error, retry }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="theme-classic min-h-screen">
      <div className="mx-auto max-w-[480px] px-5 py-24 flex flex-col items-center text-center gap-5">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--heading)' }}>
          Just a moment 🙏
        </h1>
        <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-muted)' }}>
          This page didn’t load properly. Please try again.
          <br />
          <span lang="es-MX">Esta página no cargó bien. Por favor intenta de nuevo.</span>
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="d-btn-gold rounded-full px-8 py-3 text-lg font-bold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Try again · Reintentar
        </button>
      </div>
    </main>
  )
}
