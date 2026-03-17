import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Donor Portal',
  description: 'Sign in to view your funded projects, verified documents, and blockchain-anchored financial records on Sealayer.',
  openGraph: {
    title: 'Donor Portal — Sealayer',
    description: 'View your funded projects and verified documents.',
  },
}

export default function DonorLayout({ children }: { children: React.ReactNode }) {
  return children
}
