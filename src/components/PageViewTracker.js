'use client'

import { useEffect, useRef } from 'react'
import { recordPageView } from '@/app/donate/[slug]/actions'

const VISITOR_KEY = 'bh_visitor_id'

// A random id kept in this browser so the admin can count unique visitors.
// Storage can be blocked (private mode, in-app browsers); the view still counts.
function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export default function PageViewTracker({ slug }) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    recordPageView({
      slug,
      visitorId: getVisitorId(),
      referrer: document.referrer,
      utmSource: new URLSearchParams(window.location.search).get('utm_source'),
    }).catch(() => {})
  }, [slug])

  return null
}
