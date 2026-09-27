// Short, readable name for a donor's browser, e.g. "Facebook app · iPhone".
// In-app browsers are named first because PayPal's popup often fails in them.
export function browserLabel(userAgent) {
  if (!userAgent) return null
  const ua = userAgent

  const browser =
    /FBAN|FBAV|FB_IAB|FBIOS/.test(ua) ? 'Facebook app'
    : /Instagram/.test(ua) ? 'Instagram app'
    : /musical_ly|TikTok|BytedanceWebview/i.test(ua) ? 'TikTok app'
    : /WhatsApp/i.test(ua) ? 'WhatsApp'
    : /Messenger/i.test(ua) ? 'Messenger'
    : /Edg\//.test(ua) ? 'Edge'
    : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
    : /CriOS|Chrome\//.test(ua) && !/; wv\)/.test(ua) ? 'Chrome'
    : /; wv\)/.test(ua) ? 'Android in-app browser'
    : /FxiOS|Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : 'Other browser'

  const device =
    /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : null

  return device ? `${browser} · ${device}` : browser
}
