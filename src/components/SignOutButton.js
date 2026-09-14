'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton({ className = '' }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className={`text-sm font-bold rounded-lg px-4 py-2 transition-colors ${className}`}
      style={{ background: 'var(--a-surface-2)', border: '1px solid var(--a-border)', color: 'var(--a-text)' }}
    >
      Sign out
    </button>
  )
}
