import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import DonationForm from '@/components/DonationForm'

export default async function DonatePage({ params }) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: page } = await supabase
    .from('pages')
    .select('id, title, subtitle, hero_image_url, enabled_gateways, theme')
    .eq('slug', slug)
    .single()

  if (!page) notFound()

  const { data: donors } = await supabase
    .from('public_donor_wall')
    .select('id, display_name, amount, currency, message, created_at')
    .eq('page_id', page.id)
    .limit(20)

  return (
    <main className={`theme-${page.theme || 'classic'} min-h-screen`}>
    <div className="mx-auto max-w-[600px] px-5 py-14 flex flex-col gap-7">
      <div className="flex flex-col items-center text-center gap-4">
        <div className="halo">
          <div
            className="relative w-full h-full rounded-full overflow-hidden border"
            style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
          >
            {page.hero_image_url && (
              <Image src={page.hero_image_url} alt="" fill sizes="112px" quality={95} className="object-cover" />
            )}
          </div>
        </div>
        <h1
          className="text-4xl font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--heading)', textWrap: 'balance' }}
        >
          {page.title}
        </h1>
        <p className="text-[15px] leading-relaxed max-w-[440px]" style={{ color: 'var(--ink-muted)' }}>
          {page.subtitle}
        </p>
      </div>

      <DonationForm slug={slug} enabledGateways={page.enabled_gateways} />

      <div className="flex flex-col items-center gap-3 pt-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="var(--gold-bright)" strokeWidth="1.8">
            <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
          </svg>
          Secure &amp; trusted payment
        </div>
        <div className="flex gap-2 flex-wrap justify-center">
          {['SSL encrypted', 'PCI compliant'].map((label) => (
            <span
              key={label}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
              style={{ background: 'var(--success-bg)', color: 'var(--success-text)' }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M4 12l5 5L20 6" />
              </svg>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border p-7" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex flex-col items-center gap-1 mb-5">
          <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--heading)' }}>
            Recent Donors
          </h2>
        </div>
        {(!donors || donors.length === 0) ? (
          <p className="text-center text-sm py-6" style={{ color: 'var(--ink-muted)' }}>
            No donors yet — be the first to support this page.
          </p>
        ) : (
          <div className="flex flex-col">
            {donors.map((d, i) => (
              <div
                key={d.id}
                className="grid gap-x-3.5 py-4"
                style={{
                  gridTemplateColumns: '44px 1fr auto',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                }}
              >
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-semibold"
                  style={{ background: 'var(--gold-soft)', color: 'var(--gold)', fontFamily: 'var(--font-display)' }}
                >
                  {d.display_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div className="font-semibold text-sm">{d.display_name}</div>
                  <div className="text-xs" style={{ color: 'var(--ink-muted)' }}>
                    {new Date(d.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="font-semibold text-sm tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
                  ${Number(d.amount).toFixed(2)}
                </div>
                {d.message && (
                  <div className="col-span-2 col-start-2 mt-2.5 text-sm italic" style={{ color: 'var(--ink-muted)' }}>
                    &ldquo;{d.message}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </main>
  )
}
