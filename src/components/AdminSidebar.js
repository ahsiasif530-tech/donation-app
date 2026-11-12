'use client'

import { useEffect, useState } from 'react'

// The dashboard's sections, kept in view at the side on wide screens; the
// section on screen is highlighted as you scroll.
export default function AdminSidebar({ sections, links }) {
  const [current, setCurrent] = useState(sections[0]?.id)

  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean)
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setCurrent(visible[0].target.id)
      },
      { rootMargin: '-80px 0px -60% 0px' }
    )
    els.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [sections])

  return (
    <nav aria-label="Dashboard sections" className="sticky top-24 space-y-6">
      <div className="space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--a-text-muted)' }}>Dashboard</p>
        {sections.map((s) => {
          const on = s.id === current
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors"
              style={{ background: on ? 'var(--a-surface)' : 'transparent', color: on ? 'var(--a-text)' : 'var(--a-text-muted)', border: `1px solid ${on ? 'var(--a-border)' : 'transparent'}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? 'var(--a-accent)' : 'var(--a-border)' }} />
              {s.label}
            </a>
          )
        })}
      </div>
      <div className="space-y-0.5">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--a-text-muted)' }}>More</p>
        {links.map((l) => (
          <a key={l.href} href={l.href} className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold hover:opacity-80" style={{ color: 'var(--a-text-muted)' }}>
            <span aria-hidden="true">{l.icon}</span>
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  )
}
