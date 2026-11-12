// Donation pages that have their own address. On these hosts the root (/)
// shows that page, so the link carries no other site name and no /donate path.
// The host must also be added to the project in Vercel (Settings → Domains).
export const PAGE_BY_HOST = {
  'royalgrace.vercel.app': 'royal-grace',
  'hopeharvest-give.vercel.app': 'hope-harvest',
  'goldenmercy.vercel.app': 'golden-mercy',
  'midnightlight.vercel.app': 'midnight-light',
}

export const PAGES_WITH_OWN_DOMAIN = new Set(Object.values(PAGE_BY_HOST))
