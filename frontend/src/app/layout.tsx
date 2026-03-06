import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Tulip DS — Verification Infrastructure',
    template: '%s | Tulip DS',
  },
  description: 'Cryptographic verification infrastructure for NGOs, donors, and enterprises. Powered by Bright Bytes Technology.',
  keywords: ['NGO verification', 'blockchain audit', 'transparency', 'impact reporting', 'data integrity'],
  authors: [{ name: 'Bright Bytes Technology', url: 'https://tulipds.com' }],
  openGraph: {
    title: 'Tulip DS — Verification Infrastructure',
    description: 'Tamper-proof audit trails and blockchain verification for organizations that need to prove their integrity.',
    url: 'https://tulipds.com',
    siteName: 'Tulip DS',
    locale: 'en_US',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background antialiased">
        {children}
      </body>
    </html>
  )
}
