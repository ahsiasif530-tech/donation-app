import Link from 'next/link'
import { CONTACT_EMAIL, POLICY_UPDATED, SITE_NAME } from '@/lib/site'

export const metadata = {
  title: `Privacy policy · ${SITE_NAME}`,
  description: `What information ${SITE_NAME} collects when you give, and how it is used.`,
}

export default function PrivacyPage() {
  return (
    <>
      <section className="site-hero">
        <p className="site-eyebrow">Privacy policy</p>
        <h1>Your information, handled with care</h1>
        <p className="site-small">Last updated: {POLICY_UPDATED}</p>
      </section>

      <div className="site-card">
        <h2>What we collect when you give</h2>
        <ul>
          <li>The name you enter, or “Anonymous” if you choose to hide it</li>
          <li>Your email address, only if you give one (it is optional)</li>
          <li>Your country, the amount and any message you write</li>
          <li>Basic technical details such as your browser type</li>
        </ul>
      </div>

      <div className="site-card">
        <h2>Payments</h2>
        <p>
          Payments are processed by PayPal. Your card number and PayPal login go straight to PayPal; we never see or
          store them. PayPal’s own privacy policy applies to the payment itself.
        </p>
      </div>

      <div className="site-card">
        <h2>How we use it</h2>
        <ul>
          <li>To record your gift and give you a receipt</li>
          <li>To show the name you enter, the amount and your message on the page’s donor list, unless you give anonymously</li>
          <li>If you leave a gift unfinished and gave your email, to send a reminder with a link to finish it</li>
          <li>To count page visits (anonymously) so we know which pages people find helpful</li>
        </ul>
        <p><strong>We never sell or share your information</strong> with advertisers or anyone else.</p>
      </div>

      <div className="site-card">
        <h2>Cookies and storage</h2>
        <p>
          Your browser keeps a small note of an unfinished gift so you can pick up where you left off, and a random
          visitor number used only for visit counts. We do not use advertising cookies.
        </p>
      </div>

      <div className="site-card">
        <h2>Your choices</h2>
        <p>
          You can ask us to see, correct or delete your information at any time. Email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use our <Link href="/contact">contact page</Link>.
        </p>
      </div>
    </>
  )
}
