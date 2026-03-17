import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Setup Your Organisation — Sealayer',
  description: 'Complete your organisation profile, create your first project, and invite your team.',
}

export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return children
}
