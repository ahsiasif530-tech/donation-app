// Sent with every page. No full Content-Security-Policy: PayPal's checkout
// loads scripts and frames from many of its own hosts, and a strict list
// would break payments whenever PayPal changes them.
const securityHeaders = [
  // Always HTTPS, including subdomains, for two years.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // No other site may show these pages inside a frame (clickjacking).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Payment stays allowed: Apple Pay / Google Pay run inside PayPal's frames.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), usb=(), interest-cohort=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: {
    qualities: [75, 95],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
};

export default nextConfig;
