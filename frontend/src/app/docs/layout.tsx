import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API Documentation',
  description: 'Complete API reference for Tulip DS. Authenticate, create projects, upload documents, verify hashes, and anchor data to the Polygon blockchain.',
  alternates: { canonical: 'https://tulipds.com/docs' },
  openGraph: {
    title: 'API Documentation — Tulip DS',
    description: 'Complete API reference for blockchain-verified audit trails, document management, and hash verification.',
    url: 'https://tulipds.com/docs',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'API Documentation — Tulip DS',
    description: 'Complete API reference for blockchain-verified audit trails, document management, and hash verification.',
  },
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return children
}
