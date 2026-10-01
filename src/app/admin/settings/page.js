import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, getSignedInUser } from '@/lib/supabase/server'
import PaymentSettingsLock from '@/components/PaymentSettingsLock'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const user = await getSignedInUser(supabase)

  if (!user) redirect('/login')

  // The settings are only sent once the settings password is entered.
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <main className="admin-theme min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-medium" style={{ color: 'var(--a-text-muted)' }}>← Back to admin</Link>
          <h1 className="text-2xl font-bold mt-2">Payment settings</h1>
          <p className="text-sm" style={{ color: 'var(--a-text-muted)' }}>Applies to all donation pages.</p>
        </div>

        <div className="rounded-2xl border p-6" style={{ background: 'var(--a-surface)', borderColor: 'var(--a-border)' }}>
          <PaymentSettingsLock />
        </div>
      </div>
    </main>
  )
}
