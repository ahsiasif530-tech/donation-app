import { PAGE_BY_HOST, MAIN_SITE } from './src/lib/pageDomains.js'

// Sent with every page. No full Content-Security-Policy: PayPal's checkout
// loads scripts and frames from many of its own hosts, and a strict list
// would break payments whenever PayPal changes them.
const securityHeaders = [
  // Always HTTPS, including subdomains, for two years.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // No other site may show these pages inside a frame (clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; upgrade-insecure-requests",
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Keeps other sites' windows from reaching into ours, while PayPal's
  // checkout popup can still talk back to the page that opened it.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  // No Flash/PDF plug-in may load cross-site policy files from this site.
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  // Payment stays allowed: Apple Pay / Google Pay run inside PayPal's frames.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), usb=(), interest-cohort=()' },
]

// Admin, dashboard and login are never shown in search results.
const privateHeaders = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]

// A host value is matched as a pattern, so its dots are escaped.
const hostIs = (host) => [{ type: 'host', value: host.replace(/\./g, '\\.') }]
const ownHosts = Object.entries(PAGE_BY_HOST)

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    qualities: [75, 95],
    // AVIF first (smallest), WebP for browsers without it.
    formats: ['image/avif', 'image/webp'],
    // Resized pictures are kept a week instead of being remade on every
    // visit. A replaced picture gets a new file name, so this never shows a
    // stale one.
    minimumCacheTTL: 604800,
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/images/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] },
      ...['/admin/:path*', '/dashboard/:path*', '/login'].map((source) => ({ source, headers: privateHeaders })),
    ]
  },
  // Handled at the edge with no server round trip. A page that once had its
  // own .vercel.app address now lives on the main site at a short path: the
  // old address sends visitors there, and its /donate link moves to the short
  // path too. Query strings (?resume=…) are kept. The page's files (/_next)
  // still load from an old host, so a page already open there keeps working.
  async redirects() {
    return [
      ...ownHosts.flatMap(([host, slug]) => [
        { source: '/', has: hostIs(host), destination: `${MAIN_SITE}/${slug}`, permanent: false },
        { source: '/:path((?!_next/).+)', has: hostIs(host), destination: `${MAIN_SITE}/:path`, permanent: false },
      ]),
      ...ownHosts.map(([, slug]) => ({ source: `/donate/${slug}`, destination: `/${slug}`, permanent: false })),
    ]
  },
  async rewrites() {
    return {
      beforeFiles: ownHosts.map(([, slug]) => ({ source: `/${slug}`, destination: `/donate/${slug}` })),
    }
  },
};

export default nextConfig;
