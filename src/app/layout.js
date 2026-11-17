import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Rarely used, so it isn't preloaded on every page (donation pages included).
  preload: false,
});

export const metadata = {
  title: "BlessedHands",
  description: "Create and manage donation pages and invoices.",
  // Proves to Meta (Facebook) that this business owns blesshandss.com.
  other: {
    "facebook-domain-verification": "76q3w4reojq050sp0fx8n8f6iki0fr",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
