import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// The signed-in user ({ id }) or null. getClaims() verifies the session's JWT
// locally (the project signs with asymmetric keys), so unlike getUser() it
// doesn't wait on a request to Supabase Auth before the page can load its data.
export async function getSignedInUser(supabase) {
  const { data } = await supabase.auth.getClaims()
  const id = data?.claims?.sub
  return id ? { id } : null
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component; safe to ignore
            // because middleware refreshes the session on every request.
          }
        },
      },
    }
  )
}
