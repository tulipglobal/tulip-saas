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
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-50 text-gray-400 border border-gray-200 hover:border-gray-300 transition-all cursor-pointer"
      >
        <XCircle size={10} /> No seal
      </button>
    )
  }

  if (status === 'confirmed' || status === 'anchored') {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-50 text-green-600 border border-green-200 hover:border-green-300 transition-all cursor-pointer"
      >
        <CheckCircle size={10} /> Anchored
      </button>
    )
  }

  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-yellow-50 text-yellow-600 border border-yellow-200 hover:border-yellow-300 transition-all cursor-pointer"
    >
      <Clock size={10} /> Pending
    </button>
  )
}
