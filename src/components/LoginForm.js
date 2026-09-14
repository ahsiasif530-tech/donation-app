'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)

    if (signInError) {
      setError('Email ba password thik nei.')
      return
    }

    router.push(searchParams.get('next') || '/dashboard')
    router.refresh()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl shadow-sm p-8 space-y-5 border"
      style={{ background: 'var(--a-surface)', borderColor: 'var(--a-border)' }}
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--a-text-muted)' }}>Team dashboard access</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
          style={{ background: 'var(--a-surface-2)', borderColor: 'var(--a-border)', color: 'var(--a-text)' }}
        />
      </div>

      {error && <p className="text-sm" style={{ color: 'var(--a-danger)' }}>{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg text-sm font-bold py-2.5 disabled:opacity-50 transition-transform hover:-translate-y-0.5"
        style={{ background: 'var(--a-accent)', color: 'var(--a-accent-ink)' }}
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
