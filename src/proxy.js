import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { PAGE_BY_HOST, HOST_BY_PAGE, MAIN_SITE } from '@/lib/pageDomains'

const PROTECTED_PREFIXES = ['/admin', '/dashboard']

export async function proxy(request) {
  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p))

  // A page's own address shows only that page: its root shows the page, its
  // own /donate path still works, another page's link (a reminder email can
  // carry one) goes to the main site, and anything else (login, admin) goes
  // back to the root. The query (?resume=...) is kept on every move.
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase()
  const search = request.nextUrl.search
  const ownSlug = PAGE_BY_HOST[host]
  if (ownSlug) {
    if (path === '/') {
      const url = request.nextUrl.clone()
      url.pathname = `/donate/${ownSlug}`
      return NextResponse.rewrite(url)
    }
    if (path === `/donate/${ownSlug}`) return NextResponse.next()
    if (path.startsWith('/donate/')) return NextResponse.redirect(`${MAIN_SITE}${path}${search}`)
    return NextResponse.redirect(new URL('/', request.url))
  }

  // On any other host, a page that has its own address moves there.
  const slug = path.startsWith('/donate/') ? path.slice('/donate/'.length) : null
  if (slug && HOST_BY_PAGE[slug]) return NextResponse.redirect(`https://${HOST_BY_PAGE[slug]}/${search}`)

  // Only admin and dashboard need the session; other matched paths are here
  // just for the host check above.
  if (!isProtected) return NextResponse.next()

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
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/dashboard/:path*', '/donate/:path*'],
}
