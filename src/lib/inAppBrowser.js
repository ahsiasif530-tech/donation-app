// Facebook, Instagram and Messenger open links in their own browser, where
// PayPal's popup and sign-in often fail (most cancelled checkouts come from
// there). Returns 'android', 'ios', or null for any other browser.
export function inAppBrowserPlatform(userAgent) {
  if (!/FBAN|FBAV|FB_IAB|FBIOS|Instagram/.test(userAgent || '')) return null
  if (/Android/.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  return null
}

// Set once the page has tried sending this tab to Chrome, so a phone without
// Chrome (which reloads the page here) isn't sent round in a loop. Blocked
// storage counts as tried: no automatic redirect, only the banner.
const TRIED_KEY = 'bh_external_browser_tried'

export function externalBrowserTried() {
  try {
    return sessionStorage.getItem(TRIED_KEY) === '1'
  } catch {
    return true
  }
}

export function markExternalBrowserTried() {
  try {
    sessionStorage.setItem(TRIED_KEY, '1')
  } catch {}
}
