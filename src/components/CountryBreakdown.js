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

// Completed donations per country as a grid of tiles, largest first; the top
// country is highlighted. byCountry: [{ country, total, count }].
export default function CountryBreakdown({ byCountry, totalEarning }) {
  return (
    <div className="a-card overflow-hidden">
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--a-border)' }}>
        <h2 className="font-bold">By country</h2>
        {byCountry.length > 0 && (
          <span className="text-xs font-semibold" style={{ color: 'var(--a-text-muted)' }}>
            {byCountry.length} {byCountry.length === 1 ? 'country' : 'countries'}
          </span>
        )}
      </div>
      {byCountry.length === 0 ? (
        <p className="px-6 py-8 text-sm text-center" style={{ color: 'var(--a-text-muted)' }}>Ekhono kono completed donation নেই।</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
          {byCountry.map((c, i) => {
            const share = totalEarning > 0 ? (c.total / totalEarning) * 100 : 0
            const code = flagCode(c.country)
            const top = i === 0
            return (
              <div
                key={c.country}
                className="rounded-xl border p-3.5 flex flex-col gap-2 min-w-0"
                style={{
                  background: 'var(--a-surface-2)',
                  borderColor: top ? 'var(--a-accent)' : 'var(--a-border)',
                  boxShadow: top ? '0 10px 30px -14px rgba(212,175,55,0.45)' : undefined,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {code ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny external flag icons, optimizer adds no value
                    <img src={`https://flagcdn.com/24x18/${code}.png`} alt="" width="20" height="15" className="rounded-[2px] shrink-0" />
                  ) : (
                    <span className="w-5 h-[15px] rounded-[2px] shrink-0" style={{ background: 'var(--a-border)' }} />
                  )}
                  <span className="text-sm font-semibold truncate" title={c.country}>{c.country}</span>
                </div>
                <p className={`a-display text-xl font-semibold tabular-nums ${top ? 'a-gold-text' : ''}`}>${c.total.toFixed(2)}</p>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--a-text-muted)' }}>
                  <span>{c.count} {c.count === 1 ? 'donor' : 'donors'}</span>
                  <span className="font-bold tabular-nums" style={{ color: 'var(--a-accent-strong)' }}>{percentLabel(share)}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--a-border)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(share, 2)}%`, background: 'linear-gradient(90deg, var(--a-accent), var(--a-accent-strong))' }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
