import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PaymentSettingsForm from '@/components/PaymentSettingsForm'

export default async function AdminSettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: settings } = await supabase
    .from('settings')
    .select('payment_settings')
    .eq('id', 'global')
    .single()

  return (
    <main className="admin-theme min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link href="/admin" className="text-sm font-medium" style={{ color: 'var(--a-text-muted)' }}>← Back to admin</Link>
          <h1 className="text-2xl font-bold mt-2">Payment settings</h1>
          <p className="text-sm" style={{ color: 'var(--a-text-muted)' }}>Applies to all donation pages.</p>
        </div>

        <div className="rounded-2xl border p-6" style={{ background: 'var(--a-surface)', borderColor: 'var(--a-border)' }}>
          <PaymentSettingsForm initialSettings={settings?.payment_settings} />
        </div>
      </div>
    </main>
  )
}
