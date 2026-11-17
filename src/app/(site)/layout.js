import Link from 'next/link'
import { Fraunces, Karla } from 'next/font/google'
import { SITE_NAME } from '@/lib/site'
import './site.css'

const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-display' })
const karla = Karla({ subsets: ['latin'], variable: '--font-body' })

// The public pages about who runs this site: home (about), contact, privacy.
export default function SiteLayout({ children }) {
  return (
    <div className={`${fraunces.variable} ${karla.variable} site`}>
      <header className="site-head">
        <Link href="/" className="site-brand">{SITE_NAME}</Link>
        <nav className="site-nav">
          <Link href="/">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-foot">
        {/* The team's way in: the copyright line quietly links to the login. */}
        <p><a href="/login" className="site-quiet">© {new Date().getFullYear()} {SITE_NAME}</a></p>
        <nav>
          <Link href="/">About</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  )
}
