// payment_settings.paypal holds several PayPal accounts, only one of which is
// active (used for new donations) at a time:
//   { enabled, active_account_id, accounts: [{ id, label, mode, email, client_id, secret }] }
// Settings saved before multiple accounts existed kept a single account's
// fields directly on payment_settings.paypal; those read as one account, 'default'.

export const MAX_PAYPAL_ACCOUNTS = 20

const LEGACY_ACCOUNT_ID = 'default'

export function getPaypalAccounts(paypal) {
  if (Array.isArray(paypal?.accounts)) return paypal.accounts
  if (paypal?.client_id || paypal?.email) {
    return [
      {
        id: LEGACY_ACCOUNT_ID,
        label: 'PayPal 1',
        mode: paypal.mode || 'sandbox',
        email: paypal.email || '',
        client_id: paypal.client_id || '',
        secret: paypal.secret || '',
      },
    ]
  }
  return []
}

export function getActivePaypalAccountId(paypal) {
  return Array.isArray(paypal?.accounts) ? paypal.active_account_id || null : LEGACY_ACCOUNT_ID
}

export function getActivePaypalAccount(paypal) {
  const activeId = getActivePaypalAccountId(paypal)
  return getPaypalAccounts(paypal).find((a) => a.id === activeId) || null
}

export function findPaypalAccount(paypal, accountId) {
  return getPaypalAccounts(paypal).find((a) => a.id === accountId) || null
}
