'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg text-sm font-bold px-4 py-2 transition-transform hover:-translate-y-0.5"
      style={{ background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }}
    >
      Print / Save as PDF
    </button>
  )
}
