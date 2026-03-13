'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle, Clock, XCircle } from 'lucide-react'

interface BlockchainStatusPillProps {
  sealId?: string | null
  anchorStatus?: string | null
  txHash?: string | null
  onClick?: () => void
}

export default function BlockchainStatusPill({ sealId, anchorStatus, txHash, onClick }: BlockchainStatusPillProps) {
  const t = useTranslations()
  const status = anchorStatus || (sealId ? 'pending' : null)

  if (!sealId && !status) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#e1eedd] text-[#183a1d]/50 border border-[#c8d6c0] hover:border-[#183a1d]/30 transition-all cursor-pointer"
      >
        <XCircle size={10} /> {t('seal.noSeal')}
      </button>
    )
  }

  if (status === 'confirmed' || status === 'anchored') {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-600 border border-green-200 hover:border-green-300 transition-all cursor-pointer"
      >
        <CheckCircle size={10} /> {t('seal.anchored')}
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f6c453]/15 text-[#f0a04b] border border-[#f6c453]/30 hover:border-[#f0a04b] transition-all cursor-pointer"
    >
      <Clock size={10} /> {t('seal.pending')}
    </button>
  )
}
