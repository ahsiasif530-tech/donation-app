import { createClient, getSignedInUser } from '@/lib/supabase/server'

// For admin-only route handlers: the signed-in admin's Supabase client, or a
// ready 401/403 response to return instead.
export async function adminClientOrResponse() {
  const supabase = await createClient()
  const user = await getSignedInUser(supabase)
  if (!user) return { response: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { response: Response.json({ error: 'Forbidden' }, { status: 403 }) }
  return { supabase }
}
