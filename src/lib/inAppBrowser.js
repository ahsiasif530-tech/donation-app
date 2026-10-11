// Facebook, Instagram and Messenger open links in their own browser, where
// PayPal's popup and sign-in often fail (most cancelled checkouts come from
// there). Returns 'android', 'ios', or null for any other browser.
export function inAppBrowserPlatform(userAgent) {
  if (!/FBAN|FBAV|FB_IAB|FBIOS|Instagram/.test(userAgent || '')) return null
  if (/Android/.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  return null
}

// Each way of sending this tab to Chrome (on load, on the first tap) is tried
// once per tab, so a phone without Chrome (which reloads the page here) isn't
// sent round in a loop. Blocked storage counts as tried: only the banner stays.
const TRIED_KEY = 'bh_external_browser_tried'
const TAP_TRIED_KEY = 'bh_external_browser_tap_tried'

function flagSet(key) {
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return true
  }
}

function setFlag(key) {
  try {
    sessionStorage.setItem(key, '1')
  } catch {}
}

export const externalBrowserTried = () => flagSet(TRIED_KEY)
export const markExternalBrowserTried = () => setFlag(TRIED_KEY)
export const tapRedirectTried = () => flagSet(TAP_TRIED_KEY)
export const markTapRedirectTried = () => setFlag(TAP_TRIED_KEY)
