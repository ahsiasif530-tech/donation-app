import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

// The settings table holds PayPal secrets and is closed to every signed-in
// user by RLS (admins included), so it's read only here with the service key.
// Callers must have checked that the viewer is an admin before using the result.
export async function readPaymentSettings() {
  const { data } = await createAdminClient().from('settings').select('payment_settings').eq('id', 'global').single()
  return data?.payment_settings || {}
}
