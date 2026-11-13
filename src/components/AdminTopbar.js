import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import CommandSearch from '@/components/CommandSearch'
import LiveDonations from '@/components/LiveDonations'
import AdminSky from '@/components/AdminSky'
import { initials } from '@/lib/avatar'

const TABS = [
  { key: 'dashboard', href: '/admin', label: 'Dashboard', short: 'Dashboard' },
  { key: 'traffic', href: '/admin/traffic', label: 'Traffic', short: 'Traffic' },
  { key: 'settings', href: '/admin/settings', label: 'Payment Settings', short: 'Settings' },
]

// The admin's sticky top bar: brand, section tabs (the current one lit),
// search, live gift alerts and the signed-in admin.
export default function AdminTopbar({ active, name }) {
  const tabs = (short) =>
    TABS.map((t) => (
      <Link key={t.key} href={t.href} aria-current={t.key === active ? 'page' : undefined}>
        {short ? t.short : t.label}
      </Link>
    ))

  return (
    <header className="a-topbar">
      <div className="a-wide h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link href="/admin" className="a-brand-sm a-gold-text">BlessedHands</Link>
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest rounded-md px-1.5 py-0.5" style={{ background: 'var(--a-surface-2)', color: 'var(--a-text-muted)' }}>Admin</span>
        </div>
        <nav className="a-nav hidden md:inline-flex" aria-label="Admin">{tabs(false)}</nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <CommandSearch />
          <LiveDonations />
          <AdminSky />
          <span className="a-avatar hidden sm:inline-flex" style={{ background: 'linear-gradient(135deg, var(--a-accent-strong), var(--a-accent))', width: 32, height: 32, borderRadius: 10 }} title={name}>
            {initials(name)}
          </span>
          <SignOutButton />
        </div>
      </div>
      <nav className="a-nav flex md:hidden w-fit mx-auto mb-3" aria-label="Admin">{tabs(true)}</nav>
    </header>
  )
}
