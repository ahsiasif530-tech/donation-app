import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Bypasses Row Level Security. Server-only (route handlers / server actions).
// Never import this from a Client Component.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
