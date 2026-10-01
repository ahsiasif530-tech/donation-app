'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getSignedInUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_PAYPAL_ACCOUNTS } from '@/lib/paypalAccounts'
import {
  MIN_PASSWORD_LENGTH,
  getSettingsPasswordHash,
  passwordMatches,
  createSettingsPasswordHash,
  replaceSettingsPasswordHash,
} from '@/lib/settingsLock'

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

// Payment settings sit behind their own password (see lib/settingsLock):
// asked every time the page is opened, and checked again on every save.
const slowDownGuessing = () => new Promise((resolve) => setTimeout(resolve, 1000))

async function settingsPasswordIsCorrect(admin, password) {
  if (passwordMatches(password, await getSettingsPasswordHash(admin))) return true
  await slowDownGuessing()
  return false
}

function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`
  }
  return null
}

async function readPaymentSettings(admin) {
  const { data: settings } = await admin.from('settings').select('payment_settings').eq('id', 'global').single()
  return settings?.payment_settings || {}
}

export async function unlockPaymentSettings(password) {
  await assertAdmin()
  const admin = createAdminClient()
  if (!(await settingsPasswordIsCorrect(admin, password))) return { error: 'Wrong password.' }
  return { settings: await readPaymentSettings(admin) }
}

// First visit only: sets the password, then opens the settings with it.
export async function createSettingsPassword(password) {
  await assertAdmin()
  const problem = passwordProblem(password)
  if (problem) return { error: problem }

  const admin = createAdminClient()
  const { error } = await createSettingsPasswordHash(admin, password)
  if (error) return { error: 'A settings password already exists. Reload the page and enter it.' }
  return { settings: await readPaymentSettings(admin) }
}

export async function changeSettingsPassword(currentPassword, newPassword) {
  await assertAdmin()
  const admin = createAdminClient()
  if (!(await settingsPasswordIsCorrect(admin, currentPassword))) return { error: 'Current password is wrong.' }
  const problem = passwordProblem(newPassword)
  if (problem) return { error: problem }

  const { error } = await replaceSettingsPasswordHash(admin, newPassword)
  if (error) return { error: error.message }
  return { success: true }
}

export async function updatePaymentSettings(paymentSettings, password) {
  await assertAdmin()
  if (!(await settingsPasswordIsCorrect(createAdminClient(), password))) {
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
