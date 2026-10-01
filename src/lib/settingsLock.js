import 'server-only'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

// The Payment Settings password lives in its own row of the settings table
// (admin-only by RLS, read here with the service key), stored only as a salted
// scrypt hash: { password_hash: 'scrypt$<salt>$<hash>' }. Deleting that row
// in Supabase resets it, and the next visit asks for a new password.
const LOCK_ROW_ID = 'settings_lock'

export const MIN_PASSWORD_LENGTH = 8

export async function getSettingsPasswordHash(admin) {
  const { data } = await admin.from('settings').select('payment_settings').eq('id', LOCK_ROW_ID).maybeSingle()
  return data?.payment_settings?.password_hash || null
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`
}

export function passwordMatches(password, stored) {
  if (!stored || typeof password !== 'string') return false
  const [, salt, hash] = stored.split('$')
  if (!salt || !hash) return false
  const expected = Buffer.from(hash, 'hex')
  return timingSafeEqual(scryptSync(password, salt, expected.length), expected)
}

// insert (not upsert) so two first-time setups racing can't both win.
export async function createSettingsPasswordHash(admin, password) {
  return admin.from('settings').insert({ id: LOCK_ROW_ID, payment_settings: { password_hash: hashPassword(password) } })
}

export async function replaceSettingsPasswordHash(admin, password) {
  return admin.from('settings').update({ payment_settings: { password_hash: hashPassword(password) } }).eq('id', LOCK_ROW_ID)
}
