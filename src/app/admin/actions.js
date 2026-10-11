'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getSignedInUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchAll } from '@/lib/supabase/fetchAll'
import { recoverApprovedPaypalOrders } from '@/lib/paypalDonations'

// Asks PayPal about unfinished checkouts and captures the ones the donor
// approved but whose page closed before the payment was taken.
export async function recoverPaypalPayments() {
  const supabase = await createClient()
  const user = await getSignedInUser(supabase)
  if (!user) return { error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const result = await recoverApprovedPaypalOrders(createAdminClient())

  if (result.recovered.length > 0) {
    revalidatePath('/admin')
    revalidatePath('/donate/[slug]', 'page')
  }
  return result
}

// Records money taken out of a page's earning. The amount can't exceed what's
// left (completed donations minus earlier withdrawals).
export async function addWithdrawal({ pageId, amount, note }) {
  const supabase = await createClient()
  const user = await getSignedInUser(supabase)
  if (!user) return { error: 'Not signed in' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return { error: 'Not authorized' }

  const numericAmount = Math.round(Number(amount) * 100) / 100
  if (!numericAmount || numericAmount <= 0) {
    return { error: 'Enter an amount greater than $0.' }
  }

  // Checked and inserted in one locked database call (add_withdrawal in
  // supabase/schema.sql), so two withdrawals at once can't overdraw the page.
  const admin = createAdminClient()
  const fields = { p_page_id: pageId, p_amount: numericAmount, p_note: note?.trim() || null, p_created_by: user.id }
  let { data: result, error } = await admin.rpc('add_withdrawal', fields)
  // PGRST202: the function hasn't been added to the database yet
  // (supabase/migrations), so the unlocked check below is used meanwhile.
  if (error?.code === 'PGRST202') ({ data: result, error } = await addWithdrawalUnlocked(admin, fields))
  if (error) return { error: error.message }
  if (result?.error === 'insufficient') {
    return { error: `Only $${Number(result.available).toFixed(2)} is available to withdraw.` }
  }
  if (!result?.ok) return { error: 'This page could not be found.' }

  revalidatePath('/admin')
  revalidatePath(`/admin/pages/${pageId}`)
  return { success: true }
}

// Same result shape as add_withdrawal, without its lock.
async function addWithdrawalUnlocked(admin, { p_page_id, p_amount, p_note, p_created_by }) {
  const [{ data: donations, error: donationsError }, { data: withdrawals, error: withdrawalsError }] = await Promise.all([
    fetchAll(() => admin.from('donations').select('amount').eq('page_id', p_page_id).eq('status', 'completed').order('id')),
    fetchAll(() => admin.from('withdrawals').select('amount').eq('page_id', p_page_id).order('id')),
  ])
  const readError = donationsError || withdrawalsError
  if (readError) return { data: null, error: readError }

  const earned = donations.reduce((sum, d) => sum + Number(d.amount), 0)
  const withdrawn = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0)
  const available = Math.round((earned - withdrawn) * 100) / 100
  if (p_amount > available) return { data: { ok: false, error: 'insufficient', available }, error: null }

  const { error } = await admin.from('withdrawals').insert({ page_id: p_page_id, amount: p_amount, note: p_note, created_by: p_created_by })
  return { data: error ? null : { ok: true }, error }
}
