import { COUNTRIES } from '@/lib/countries'

// donor_country holds a country name, or PayPal's two-letter code when the
// name wasn't in our list.
function flagCode(country) {
  if (/^[A-Z]{2}$/.test(country)) return country.toLowerCase()
  return COUNTRIES.find((c) => c.name === country)?.code.toLowerCase() || null
}

function percentLabel(share) {
  if (share > 0 && share < 1) return '<1%'
  return `${Math.round(share)}%`
}

function Flag({ code, size }) {
  const height = Math.round(size * 0.75)
  if (!code) return <span className="rounded-[2px] shrink-0" style={{ width: size, height, background: 'var(--a-border)' }} />
  // eslint-disable-next-line @next/next/no-img-element -- tiny external flag icons, optimizer adds no value
  return <img src={`https://flagcdn.com/24x18/${code}.png`} alt="" width={size} height={height} className="rounded-[2px] shrink-0" />
}

// Completed donations per country, largest first, sized for a narrow column:
// the top country as a small highlighted card, the rest as one-line rows whose
// faint gold fill shows their share. byCountry: [{ country, total, count }].
export default function CountryBreakdown({ byCountry, totalEarning }) {
  const shareOf = (c) => (totalEarning > 0 ? (c.total / totalEarning) * 100 : 0)
  const [top, ...rest] = byCountry

  return (
    <div className="a-card overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--a-border)' }}>
        <h2 className="font-bold text-sm">By country</h2>
        {byCountry.length > 0 && (
          <span className="text-[11px] font-semibold" style={{ color: 'var(--a-text-muted)' }}>
            {byCountry.length} {byCountry.length === 1 ? 'country' : 'countries'}
          </span>
        )}
      </div>
      {!top ? (
        <p className="px-4 py-6 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono completed donation নেই।</p>
      ) : (
        <div className="p-2.5 space-y-1.5">
          <div
            className="rounded-lg border px-3 py-2.5"
            style={{
              background: 'radial-gradient(120% 90% at 0% 0%, rgba(212,175,55,0.14), transparent 60%), var(--a-surface-2)',
              borderColor: 'var(--a-accent)',
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Flag code={flagCode(top.country)} size={18} />
              <span className="text-xs font-semibold truncate flex-1" title={top.country}>{top.country}</span>
              <span className="text-[10px] font-bold rounded px-1.5 py-px" style={{ background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }}>#1</span>
            </div>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <span className="a-display a-gold-text text-xl font-semibold tabular-nums">${top.total.toFixed(2)}</span>
              <span className="text-[11px]" style={{ color: 'var(--a-text-muted)' }}>
                {top.count} {top.count === 1 ? 'donor' : 'donors'} ·{' '}
                <span className="font-bold" style={{ color: 'var(--a-accent-strong)' }}>{percentLabel(shareOf(top))}</span>
              </span>
            </div>
            <div className="h-1 mt-1.5 rounded-full overflow-hidden" style={{ background: 'var(--a-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${shareOf(top)}%`, background: 'linear-gradient(90deg, var(--a-accent), var(--a-accent-strong))' }} />
            </div>
          </div>

          {rest.map((c, i) => {
            const share = shareOf(c)
            const second = i === 0
            return (
              <div
                key={c.country}
                className={`flex items-center gap-2 rounded-lg px-2.5 min-w-0 ${second ? 'py-2 text-xs' : 'py-1.5 text-[11px]'}`}
                style={{
                  background: `linear-gradient(90deg, rgba(212,175,55,0.12) ${Math.max(share, 1)}%, var(--a-surface-2) ${Math.max(share, 1)}%)`,
                }}
              >
                <span className="w-5 shrink-0 font-bold tabular-nums" style={{ color: 'var(--a-text-muted)' }}>#{i + 2}</span>
                <Flag code={flagCode(c.country)} size={second ? 16 : 14} />
                <span className="font-semibold truncate flex-1" title={c.country}>{c.country}</span>
                <span className="shrink-0 inline-flex items-center gap-0.5" style={{ color: 'var(--a-text-muted)' }} title={`${c.count} ${c.count === 1 ? 'donor' : 'donors'}`}>
                  {c.count}
                  <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true">
                    <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.4 0-8 2.2-8 5v2h16v-2c0-2.8-3.6-5-8-5Z" />
                  </svg>
                </span>
                <span className="shrink-0 w-14 text-right font-bold tabular-nums">${c.total.toFixed(2)}</span>
                <span className="shrink-0 w-7 text-right font-bold tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>{percentLabel(share)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
