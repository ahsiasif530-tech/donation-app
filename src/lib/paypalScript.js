import { getMessages } from '@/lib/i18n'

// The PayPal SDK options for each kind of checkout on a donation page. The
// donation form loads PayPal with these, and the page preloads the same URL,
// so both have to come from here to match exactly.
const COMPONENTS = {
  // PayPal's own black card button stays (it asks for a billing address, but the
  // account isn't approved for the address-free Card option); Pay Later is hidden.
  buttons: { components: 'buttons', disableFunding: 'paylater' },
  cardFields: { components: 'card-fields' },
  // Apple Pay / Google Pay ride on the same PayPal merchant app as PayPal itself.
  express: { components: 'buttons,applepay,googlepay' },
}

export function paypalScriptOptions(kind, clientId, locale) {
  const paypalLocale = getMessages(locale).paypalLocale
  return {
    clientId,
    currency: 'USD',
    ...COMPONENTS[kind],
    // PayPal's buttons and card form in the page's language (none: PayPal's default).
    ...(paypalLocale && { locale: paypalLocale }),
  }
}

// The script URL @paypal/paypal-js builds from these options (its
// processOptions): keys in order, camelCase turned kebab-case, values as-is.
export function paypalSdkUrl(options) {
  const query = Object.entries(options)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}=${value}`)
    .join('&')
  return `https://www.paypal.com/sdk/js?${query}`
}
