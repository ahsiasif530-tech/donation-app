'use client'

import { useState, useSyncExternalStore } from 'react'

// Facebook / Instagram / Messenger open links in their own in-app browser,
// where PayPal's login window often can't open or can't report back, so donors
// get stuck on "Opened PayPal, didn't finish". This asks them to reopen the page
// in their real browser before they start.
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|Messenger/i

function getPlatform() {
  const ua = navigator.userAgent
  if (!IN_APP_BROWSER.test(ua)) return null
  return /Android/i.test(ua) ? 'android' : 'ios'
}

const subscribe = () => () => {}

export default function InAppBrowserNotice() {
  // null on the server: the page is cached HTML, so the user agent is only known in the browser.
  const platform = useSyncExternalStore(subscribe, getPlatform, () => null)
  const [copied, setCopied] = useState(false)

  if (!platform) return null

  // Android hands an intent:// link to Chrome; if Chrome isn't there the fallback
  // just reloads the page where it is.
  const openInChrome = () => {
    const { host, pathname, search, href } = window.location
    window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // Clipboard can be blocked in in-app browsers; the ••• menu instructions still apply.
    }
  }

  return (
    <div className="rounded-xl border px-4 py-4 space-y-3 text-center" style={{ borderColor: 'var(--gold-bright)', background: 'var(--gold-soft)' }}>
      <p className="text-sm font-bold" style={{ color: 'var(--heading)' }}>
        For a smooth PayPal payment, please open this page in your browser.
      </p>

      {platform === 'android' ? (
        <>
          <button
            type="button"
            onClick={openInChrome}
            className="d-btn-gold w-full rounded-xl py-3 text-base font-bold"
          >
            Open in Chrome
          </button>
          <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
            Or tap <strong>⋮</strong> at the top right and choose <strong>Open in browser</strong>.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: 'var(--ink)' }}>
            Tap <strong>•••</strong> at the top right, then <strong>Open in external browser</strong>.
          </p>
          <button
            type="button"
            onClick={copyLink}
            className="w-full rounded-xl border py-2.5 text-sm font-bold"
            style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
          >
            {copied ? 'Link copied — paste it in Safari' : 'Copy link'}
          </button>
        </>
      )}
    </div>
  )
}
