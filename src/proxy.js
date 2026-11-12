import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// Pages with their own address are routed in next.config.mjs (at the edge,
// with no server round trip); this proxy only guards admin and dashboard.
export async function proxy(request) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() refreshes an expired session and verifies the JWT locally,
  // without a round trip to Supabase Auth on every admin/dashboard request.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims?.sub ? { id: data.claims.sub } : null

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
}
