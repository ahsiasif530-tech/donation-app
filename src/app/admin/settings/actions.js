'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_PAYPAL_ACCOUNTS } from '@/lib/paypalAccounts'

async function assertAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Not authorized')
}

export async function updatePaymentSettings(paymentSettings) {
  await assertAdmin()

  const paypalAccounts = paymentSettings?.paypal?.accounts || []
  if (paypalAccounts.length > MAX_PAYPAL_ACCOUNTS) {
    return { error: `You can save at most ${MAX_PAYPAL_ACCOUNTS} PayPal accounts.` }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('settings')
    .update({ payment_settings: paymentSettings })
    .eq('id', 'global')

  if (error) return { error: error.message }

  revalidatePath('/admin/settings')
  return { success: true }
}
