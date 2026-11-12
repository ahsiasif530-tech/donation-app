// Donation pages that have their own address. On these hosts the root (/)
// shows that page, so the link carries no other site name and no /donate path.
// The host must also be added to the project in Vercel (Settings → Domains).
export const PAGE_BY_HOST = {
  'royalgrace.vercel.app': 'royal-grace',
  'hopeharvest-give.vercel.app': 'hope-harvest',
  'goldenmercy.vercel.app': 'golden-mercy',
  'midnightlight.vercel.app': 'midnight-light',
  'faithfountain.vercel.app': 'faith-fountain',
  'rosehaven.vercel.app': 'rose-haven',
  'sacredflame.vercel.app': 'sacred-flame',
  'violetprayer.vercel.app': 'violet-prayer',
  'sunrisewings.vercel.app': 'sunrise-wings',
  'holyscroll-give.vercel.app': 'holy-scroll',
  'summitgrace.vercel.app': 'summit-grace',
  'silentcross.vercel.app': 'silent-cross',
  'goldengrove-give.vercel.app': 'golden-grove',
  'chapelpeace.vercel.app': 'chapel-peace',
  'crownoflight.vercel.app': 'crown-of-light',
  'magentaglory.vercel.app': 'magenta-glory',
  'lightofhope-give.vercel.app': 'light-of-hope',
  'meadowbloom-give.vercel.app': 'meadow-bloom',
  'livingforest-give.vercel.app': 'living-forest',
  'sacredheart-give.vercel.app': 'sacred-heart',
}

// The main site, where every other page lives.
export const MAIN_SITE = 'https://www.blesshandss.com'

export const HOST_BY_PAGE = Object.fromEntries(Object.entries(PAGE_BY_HOST).map(([host, slug]) => [slug, host]))

export const PAGES_WITH_OWN_DOMAIN = new Set(Object.values(PAGE_BY_HOST))

// The address donors use for a page: its own address when it has one.
export function pageUrl(slug) {
  const host = HOST_BY_PAGE[slug]
  return host ? `https://${host}/` : `/donate/${slug}`
}
