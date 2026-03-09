import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://tulipds.com'),
  title: {
    default: 'Tulip DS — Every Document. Blockchain Verified. Forever.',
    template: '%s | Tulip DS',
  },
  description: 'Drag any document and know in seconds if it is authentic. Blockchain-verified audit trails and RFC 3161 timestamps for NGOs, donors, and enterprises.',
  keywords: ['NGO verification', 'blockchain audit', 'document verification', 'transparency', 'impact reporting', 'data integrity', 'Polygon blockchain', 'RFC 3161 timestamp', 'NGO SaaS', 'donor platform'],
  authors: [{ name: 'Bright Bytes Technology', url: 'https://tulipds.com' }],
  creator: 'Bright Bytes Technology',
  publisher: 'Bright Bytes Technology',
  openGraph: {
    title: 'Tulip DS — Every Document. Blockchain Verified. Forever.',
    description: 'Drag any document and know in seconds if it is authentic. Blockchain-verified audit trails for NGOs, donors, and enterprises.',
    url: 'https://tulipds.com',
    siteName: 'Tulip DS',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Tulip DS — Blockchain Document Verification' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tulip DS — Every Document. Blockchain Verified. Forever.',
    description: 'Blockchain-verified audit trails and RFC 3161 timestamps for NGOs, donors, and enterprises.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://tulipds.com',
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
