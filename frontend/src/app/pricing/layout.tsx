import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for blockchain-verified audit trails. Start free, scale as you grow. No hidden fees.',
  alternates: { canonical: 'https://tulipds.com/pricing' },
  openGraph: {
    title: 'Pricing — Tulip DS',
    description: 'Simple, transparent pricing for blockchain-verified audit trails. Start free, scale as you grow.',
    url: 'https://tulipds.com/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Pricing — Tulip DS',
    description: 'Simple, transparent pricing for blockchain-verified audit trails. Start free, scale as you grow.',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
