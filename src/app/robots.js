// Search engines may show donation pages, never the admin side.
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/dashboard', '/login'] },
  }
}
