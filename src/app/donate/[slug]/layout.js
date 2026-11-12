import { createPublicClient } from '@/lib/supabase/public'
import { PAGES_WITH_OWN_DOMAIN } from '@/lib/pageDomains'

// A page with its own address shows its own name in the browser tab instead
// of the site's; every other page keeps the site's title.
export async function generateMetadata({ params }) {
  const { slug } = await params
  if (!PAGES_WITH_OWN_DOMAIN.has(slug)) return {}

  const { data: page } = await createPublicClient().from('pages').select('title, subtitle').eq('slug', slug).single()
  if (!page) return {}
  return { title: page.title, description: page.subtitle }
}

export default function DonatePageLayout({ children }) {
  return children
}
