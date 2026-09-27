import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Anonymous, cookie-free client for public pages. Not reading cookies lets
// Next.js cache the donation pages instead of rendering them on every visit,
// while RLS still limits what the publishable key can read.
export function createPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
