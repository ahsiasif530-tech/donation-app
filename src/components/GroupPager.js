'use client'

// "‹ Previous · Group 2 of 9 · Next ›" for lists shown four pages at a time.
// The admin's Pages table and the traffic page share it so they read alike.
export default function GroupPager({ index, count, onChange }) {
  if (count <= 1) return null
  const button = (disabled) => ({
    borderColor: 'var(--a-border)',
    background: 'var(--a-surface-2)',
    color: 'var(--a-text)',
    opacity: disabled ? 0.35 : 1,
  })
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-3 border-t" style={{ borderColor: 'var(--a-border)' }}>
      <button type="button" disabled={index === 0} onClick={() => onChange(index - 1)} className="rounded-lg border text-xs font-bold px-3.5 py-2 hover:opacity-80" style={button(index === 0)}>
        ‹ Previous
      </button>
      <span className="text-xs" style={{ color: 'var(--a-text-muted)' }}>
        Group <b style={{ color: 'var(--a-text)' }}>{index + 1}</b> of {count}
      </span>
      <button type="button" disabled={index >= count - 1} onClick={() => onChange(index + 1)} className="rounded-lg border text-xs font-bold px-3.5 py-2 hover:opacity-80" style={button(index >= count - 1)}>
        Next ›
      </button>
    </div>
  )
}
