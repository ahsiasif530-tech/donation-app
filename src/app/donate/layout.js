import { Fraunces, Karla } from 'next/font/google'
import './donate.css'

// Both are variable fonts: with no weight list, each downloads as one file that
// covers every weight, instead of one file per weight.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
})

const karla = Karla({
  subsets: ['latin'],
  variable: '--font-body',
})

export default function DonateLayout({ children }) {
  return (
    <div className={`${fraunces.variable} ${karla.variable} min-h-screen`} style={{ fontFamily: 'var(--font-body)' }}>
      {children}
    </div>
  )
}
