// Usage: node --env-file=.env.local scripts/update-page.js <slug> <field> <value>
import { createClient } from '@supabase/supabase-js'

const [slug, field, value] = process.argv.slice(2)

if (!slug || !field || value === undefined) {
  console.error('Usage: node --env-file=.env.local scripts/update-page.js <slug> <field> <value>')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const { data, error } = await supabase
  .from('pages')
  .update({ [field]: value })
  .eq('slug', slug)
  .select()
  .single()

if (error) {
  console.error('Update failed:', error.message)
  process.exit(1)
}

console.log(`Updated ${slug}: ${field} = "${data[field]}"`)
