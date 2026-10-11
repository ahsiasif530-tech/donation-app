'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { inAppBrowserPlatform, externalBrowserTried, markExternalBrowserTried } from '@/lib/inAppBrowser'

const subscribeNever = () => () => {}

// This page's address for the outside browser. Chrome/Safari get no referrer,
// so the source is passed along as utm_source to keep the Traffic page right.
function externalUrl() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('utm_source')) {
    url.searchParams.set('utm_source', /Instagram/.test(navigator.userAgent) ? 'instagram' : 'facebook')
  }
  return url
}

// Android opens Chrome through an intent link; without Chrome, the fallback
// reloads the page here, where the banner remains.
function androidChromeLink(url) {
  const scheme = url.protocol.replace(':', '')
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`
}

// Inside Facebook/Instagram's browser: on Android the page moves itself to
// Chrome once; on iPhone (where no site may switch browsers on its own) a
// banner offers Safari (x-safari-https works on iOS 17+) and the menu steps.
export default function OpenInBrowser() {
  const platform = useSyncExternalStore(subscribeNever, () => inAppBrowserPlatform(navigator.userAgent), () => null)
  const href = platform === 'android' ? androidChromeLink(externalUrl()) : platform === 'ios' ? `x-safari-${externalUrl().href}` : null

  useEffect(() => {
    if (platform !== 'android' || externalBrowserTried()) return
    markExternalBrowserTried()
    window.location.href = androidChromeLink(externalUrl())
  }, [platform])

  if (!platform) return null

  const browser = platform === 'android' ? 'Chrome' : 'Safari'

  return (
    <div className="sticky top-0 z-30 px-4 py-3 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="mx-auto max-w-[600px] flex flex-col gap-2.5 text-center">
        <p className="text-sm font-semibold">
          For a smooth and secure payment, please open this page in {browser}.
        </p>
        <a
          href={href}
          className="d-btn-gold rounded-xl py-3 text-base font-bold"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Open in {browser}
        </a>
        <p className="text-xs" style={{ color: 'var(--ink-muted)' }}>
          If nothing happens, tap <b>•••</b> at the top right, then <b>Open in external browser</b>.
        </p>
      </div>
    </div>
  )
}
