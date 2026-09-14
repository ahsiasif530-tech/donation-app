import { Fraunces, Karla } from 'next/font/google'
import './donate.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
})

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
})

export default function DonateLayout({ children }) {
  return (
    <div className={`${fraunces.variable} ${karla.variable} min-h-screen`} style={{ fontFamily: 'var(--font-body)' }}>
      {children}
    </div>
  )
}
