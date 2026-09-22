// Usage: node --env-file=.env.local scripts/create-page.js <slug> <title> <subtitle> <hero_image_url> <gateways-comma-separated>
import { createClient } from '@supabase/supabase-js'

const [slug, title, subtitle, heroImageUrl, gatewaysCsv] = process.argv.slice(2)

if (!slug || !title) {
  console.error('Usage: node --env-file=.env.local scripts/create-page.js <slug> <title> <subtitle> <hero_image_url> <gateways-comma-separated>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const enabledGateways = (gatewaysCsv || 'paypal,stripe,bank,applepay,googlepay').split(',').map((g) => g.trim())

const { data, error } = await supabase
  .from('pages')
  .insert({
    slug,
    title,
    subtitle,
    hero_image_url: heroImageUrl || null,
    enabled_gateways: enabledGateways,
  })
  .select()
  .single()

if (error) {
  console.error('Failed to create page:', error.message)
  process.exit(1)
}

console.log(`Page created: /donate/${data.slug} (id: ${data.id})`)
