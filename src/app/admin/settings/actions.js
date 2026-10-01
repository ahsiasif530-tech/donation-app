'use server'

import { createHash, timingSafeEqual } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient, getSignedInUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_PAYPAL_ACCOUNTS } from '@/lib/paypalAccounts'

async function assertAdmin() {
  const supabase = await createClient()
  const user = await getSignedInUser(supabase)
  if (!user) throw new Error('Not signed in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') throw new Error('Not authorized')
}

// Payment settings sit behind their own password (SETTINGS_PASSWORD on the
// server): asked every time the page is opened, and checked again on save.
// Both sides are hashed first so the comparison takes the same time whatever
// the length or content of the guess.
function settingsPasswordMatches(password) {
  const expected = process.env.SETTINGS_PASSWORD
  if (!expected || typeof password !== 'string') return false
  const hash = (value) => createHash('sha256').update(value).digest()
  return timingSafeEqual(hash(password), hash(expected))
}

const slowDownGuessing = () => new Promise((resolve) => setTimeout(resolve, 1000))

export async function unlockPaymentSettings(password) {
  await assertAdmin()
  if (!process.env.SETTINGS_PASSWORD) {
    return { error: 'The settings password is not set up yet (SETTINGS_PASSWORD on Vercel).' }
  }
  if (!settingsPasswordMatches(password)) {
    await slowDownGuessing()
    return { error: 'Wrong password.' }
  }

  const { data: settings } = await createAdminClient()
    .from('settings')
    .select('payment_settings')
    .eq('id', 'global')
    .single()
  return { settings: settings?.payment_settings || {} }
}

export async function updatePaymentSettings(paymentSettings, password) {
  await assertAdmin()
  if (!settingsPasswordMatches(password)) {
    await slowDownGuessing()
    return { error: 'Wrong settings password. Reload the page and unlock it again.' }
  }

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
  // Enabled gateways are read by the cached donation pages.
  revalidatePath('/donate/[slug]', 'page')
  return { success: true }
}
