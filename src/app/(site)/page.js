import Link from 'next/link'
import { SITE_NAME } from '@/lib/site'

export const metadata = {
  title: `About us · ${SITE_NAME}`,
  description: `${SITE_NAME} is a small faith media team sharing Christian encouragement. Learn who we are and how gifts are used.`,
}

export default function AboutPage() {
  return (
    <>
      <section className="site-hero">
        <p className="site-eyebrow">About us</p>
        <h1>Sharing hope, one post at a time</h1>
        <p className="site-lead">
          {SITE_NAME} is a small faith media team. We create Christian inspirational content: prayers, Bible
          verses and uplifting messages, and share them on our Facebook pages every day.
        </p>
      </section>

      <div className="site-card">
        <h2>What your gift supports</h2>
        <p>Donations made through our pages help us keep this ministry going:</p>
        <ul>
          <li>Creating new prayers, verse images and videos</li>
          <li>Running and growing our Facebook pages</li>
          <li>Keeping this website and its secure checkout online</li>
        </ul>
        <p className="site-small">
          {SITE_NAME} is not a registered charity, so gifts are not tax-deductible. Every gift is voluntary.
        </p>
      </div>

      <div className="site-card">
        <h2>How giving works</h2>
        <p>
          Each donation page is on <strong>blesshandss.com</strong>. Payments are processed securely by PayPal, so
          we never see or store your card details. You can give as a guest or without showing your name.
        </p>
        <p>
          Have a question about a gift? <Link href="/contact">Contact us</Link>. You can read how we handle your
          information in our <Link href="/privacy">privacy policy</Link>.
        </p>
      </div>

      <p className="site-verse">
        “It is more blessed to give than to receive.”
        <span>Acts 20:35</span>
      </p>
    </>
  )
}
