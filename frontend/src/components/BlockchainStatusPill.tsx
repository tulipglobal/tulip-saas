'use client'

import { CheckCircle, Clock, XCircle } from 'lucide-react'

interface BlockchainStatusPillProps {
  sealId?: string | null
  anchorStatus?: string | null
  txHash?: string | null
  onClick?: () => void
}

export default function BlockchainStatusPill({ sealId, anchorStatus, txHash, onClick }: BlockchainStatusPillProps) {
  const status = anchorStatus || (sealId ? 'pending' : null)

  if (!sealId && !status) {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 text-white/30 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
      >
        <XCircle size={10} /> No seal
      </button>
    )
  }

  if (status === 'confirmed' || status === 'anchored') {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-400/10 text-green-400 border border-green-400/20 hover:border-green-400/40 transition-all cursor-pointer"
      >
        <CheckCircle size={10} /> Anchored
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 hover:border-yellow-400/40 transition-all cursor-pointer"
    >
      <Clock size={10} /> Pending
    </button>
  )
}
