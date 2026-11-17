import { CONTACT_EMAIL, SITE_NAME } from '@/lib/site'

export const metadata = {
  title: `Contact · ${SITE_NAME}`,
  description: `How to reach the ${SITE_NAME} team.`,
}

export default function ContactPage() {
  return (
    <>
      <section className="site-hero">
        <p className="site-eyebrow">Contact</p>
        <h1>We’d love to hear from you</h1>
        <p className="site-lead">
          Questions about a donation, a receipt, or our pages? Send us an email and our team will reply as soon as we
          can, usually within 2 business days.
        </p>
      </section>

      <div className="site-card">
        <h2>Email</h2>
        <a className="site-button" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        <p className="site-small" style={{ marginTop: 16 }}>
          About a donation? Please include the invoice number from your receipt (it starts with INV-) so we can find
          it quickly.
        </p>
      </div>

      <div className="site-card">
        <h2>Please be careful</h2>
        <p>
          We will never ask for your password, card number or PayPal login by email or message. Our donation pages are
          only on <strong>blesshandss.com</strong>.
        </p>
      </div>
    </>
  )
}
