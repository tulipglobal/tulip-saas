import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Verify a Document or Hash',
  description: 'Verify any document or SHA-256 hash against the Polygon blockchain. Drag and drop a file or paste a hash to check if it has been tamper-proof verified by Tulip DS.',
  alternates: { canonical: 'https://tulipds.com/verify' },
  openGraph: {
    title: 'Verify a Document — Tulip DS',
    description: 'Check if any document or hash is blockchain-verified. Instant verification against Polygon with full proof certificate.',
    url: 'https://tulipds.com/verify',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Verify a Document — Tulip DS',
    description: 'Check if any document or hash is blockchain-verified. Instant verification against Polygon.',
  },
}

export default function VerifyLayout({ children }: { children: React.ReactNode }) {
  return children
}
