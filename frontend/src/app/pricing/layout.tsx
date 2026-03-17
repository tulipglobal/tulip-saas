import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Simple, transparent pricing for blockchain-verified audit trails. Start free, scale as you grow. No hidden fees.',
  alternates: { canonical: 'https://sealayer.io/pricing' },
  openGraph: {
    title: 'Pricing — Sealayer',
    description: 'Simple, transparent pricing for blockchain-verified audit trails. Start free, scale as you grow.',
    url: 'https://sealayer.io/pricing',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Pricing — Sealayer',
    description: 'Simple, transparent pricing for blockchain-verified audit trails. Start free, scale as you grow.',
  },
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children
}
