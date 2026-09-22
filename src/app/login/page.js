import { Suspense } from 'react'
import LoginForm from '@/components/LoginForm'

export default function LoginPage() {
  return (
    <main className="admin-theme min-h-screen flex flex-col items-center justify-center px-4 gap-6">
      <p className="a-brand a-gold-text">BlessedHands</p>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  )
}
