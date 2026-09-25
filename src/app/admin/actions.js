'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Records money taken out of a page's earning. The amount can't exceed what's
// left (completed donations minus earlier withdrawals).
export async function addWithdrawal({ pageId, amount, note }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  const admin = createAdminClient()
  const { data: donations } = await admin
    .from('donations')
    .select('amount')
    .eq('page_id', pageId)
    .eq('status', 'completed')
  const { data: withdrawals } = await admin
    .from('withdrawals')
    .select('amount')
    .eq('page_id', pageId)

  const earned = (donations || []).reduce((sum, d) => sum + Number(d.amount), 0)
  const withdrawn = (withdrawals || []).reduce((sum, w) => sum + Number(w.amount), 0)
  const available = Math.round((earned - withdrawn) * 100) / 100
  if (numericAmount > available) {
    return { error: `Only $${available.toFixed(2)} is available to withdraw.` }
  }

  const { error } = await admin.from('withdrawals').insert({
    page_id: pageId,
    amount: numericAmount,
    note: note?.trim() || null,
    created_by: user.id,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath(`/admin/pages/${pageId}`)
  return { success: true }
}
