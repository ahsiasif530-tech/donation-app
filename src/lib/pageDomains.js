// Pages that used to have their own .vercel.app address. They now live on the
// main site at a short path (www.blesshandss.com/royal-grace), so links shared
// before still work: each old host sends visitors to that path. One domain is
// easier for Facebook and donors to trust than many free addresses.
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
  'pearlprayer-give.vercel.app': 'pearl-prayer',
  'heavensbreath-give.vercel.app': 'heavens-breath',
  'ancientgrace-give.vercel.app': 'ancient-grace',
  'starlitangel-give.vercel.app': 'starlit-angel',
  'goldenwings-give.vercel.app': 'golden-wings',
  'honeylight-give.vercel.app': 'honey-light',
  'walkoffaith-give.vercel.app': 'walk-of-faith',
  'amethystprayer-give.vercel.app': 'amethyst-prayer',
  'goodshepherd-give.vercel.app': 'good-shepherd',
  'heavensjoy-give.vercel.app': 'heavens-joy',
  'amongthepeople-give.vercel.app': 'among-the-people',
  'riseinglory-give.vercel.app': 'rise-in-glory',
  'openhands-give.vercel.app': 'open-hands',
  'tenderlove-give.vercel.app': 'tender-love',
  'charcoalgrace-give.vercel.app': 'charcoal-grace',
  'sunsetmercy-give.vercel.app': 'sunset-mercy',
}

// The admin lists pages in groups of this many (in the order they were
// made), with these pages kept apart in their own box; the traffic page
// uses the same groups so group 2 is the same four pages in both.
export const PAGES_PER_GROUP = 4
export const SEPARATE_PAGE_SLUGS = ['blesshand-mx']

// The main site, where every other page lives.
export const MAIN_SITE = 'https://www.blesshandss.com'

export const PAGES_WITH_OWN_DOMAIN = new Set(Object.values(PAGE_BY_HOST))

// The short address shown for a page, without https://.
export const HOST_BY_PAGE = Object.fromEntries([...PAGES_WITH_OWN_DOMAIN].map((slug) => [slug, `blesshandss.com/${slug}`]))

// The address donors use for a page: its short path when it has one.
export function pageUrl(slug) {
  return PAGES_WITH_OWN_DOMAIN.has(slug) ? `${MAIN_SITE}/${slug}` : `${MAIN_SITE}/donate/${slug}`
}
