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

// Built for a narrow (one-third) column: tiles shrink with rank. #1 and #2
// take a full row, then two compact tiles per row.
const TIERS = [
  { span: 'col-span-2', pad: 'p-4', flag: 26, name: 'text-sm', amount: 'text-3xl', bar: 'h-1.5' },
  { span: 'col-span-2', pad: 'p-3.5', flag: 20, name: 'text-sm', amount: 'text-xl', bar: 'h-1' },
  { span: 'col-span-1', pad: 'p-3', flag: 18, name: 'text-xs', amount: 'text-lg', bar: 'h-1' },
  { span: 'col-span-1', pad: 'p-2.5', flag: 16, name: 'text-xs', amount: 'text-base', bar: 'h-0.5' },
]

function tierFor(rank) {
  if (rank === 0) return TIERS[0]
  if (rank === 1) return TIERS[1]
  if (rank <= 3) return TIERS[2]
  return TIERS[3]
}

// Completed donations per country, largest first. byCountry: [{ country, total, count }].
export default function CountryBreakdown({ byCountry, totalEarning }) {
  return (
    <div className="a-card overflow-hidden">
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--a-border)' }}>
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
        <div className="grid grid-cols-2 gap-2.5 p-3.5">
          {byCountry.map((c, i) => {
            const share = totalEarning > 0 ? (c.total / totalEarning) * 100 : 0
            const code = flagCode(c.country)
            const tier = tierFor(i)
            const top = i === 0
            return (
              <div
                key={c.country}
                className={`${tier.span} ${tier.pad} rounded-xl border flex flex-col gap-1.5 min-w-0`}
                style={{
                  background: top
                    ? 'radial-gradient(120% 90% at 0% 0%, rgba(212,175,55,0.16), transparent 60%), var(--a-surface-2)'
                    : 'var(--a-surface-2)',
                  borderColor: top ? 'var(--a-accent)' : 'var(--a-border)',
                  boxShadow: top ? '0 14px 36px -16px rgba(212,175,55,0.5)' : undefined,
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {code ? (
                    // eslint-disable-next-line @next/next/no-img-element -- tiny external flag icons, optimizer adds no value
                    <img
                      src={`https://flagcdn.com/${top ? '48x36' : '24x18'}/${code}.png`}
                      alt=""
                      width={tier.flag}
                      height={Math.round(tier.flag * 0.75)}
                      className="rounded-[3px] shrink-0"
                    />
                  ) : (
                    <span className="rounded-[3px] shrink-0" style={{ width: tier.flag, height: Math.round(tier.flag * 0.75), background: 'var(--a-border)' }} />
                  )}
                  <span className={`${tier.name} font-semibold truncate flex-1`} title={c.country}>{c.country}</span>
                  <span
                    className="text-[11px] font-bold tabular-nums rounded-md px-1.5 py-0.5 shrink-0"
                    style={top ? { background: 'var(--a-accent)', color: 'var(--a-accent-ink)' } : { color: 'var(--a-text-muted)' }}
                  >
                    #{i + 1}
                  </span>
                </div>
                {top && (
                  <p className="text-xs font-semibold uppercase tracking-wider mt-auto" style={{ color: 'var(--a-accent-strong)' }}>
                    Top country
                  </p>
                )}
                <p className={`a-display ${tier.amount} font-semibold tabular-nums ${top ? 'a-gold-text' : ''}`}>${c.total.toFixed(2)}</p>
                <div className="flex items-center justify-between text-xs" style={{ color: 'var(--a-text-muted)' }}>
                  <span>{c.count} {c.count === 1 ? 'donor' : 'donors'}</span>
                  <span className={`font-bold tabular-nums ${top ? 'text-sm' : ''}`} style={{ color: 'var(--a-accent-strong)' }}>
                    {percentLabel(share)}
                  </span>
                </div>
                <div className={`${tier.bar} rounded-full overflow-hidden`} style={{ background: 'var(--a-border)' }}>
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
