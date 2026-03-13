'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const count = parseInt(localStorage.getItem('pendingCount') || '0', 10);
    setPendingCount(count);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#fefbe9' }}>
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-100 mx-auto">
          <WifiOff size={36} className="text-amber-600" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-[#183a1d]" style={{ fontFamily: 'Inter, sans-serif' }}>
            You&apos;re offline
          </h1>
          <p className="text-[#183a1d]/60 mt-2">
            Your data is saved locally and will sync when you reconnect.
          </p>
        </div>

        {pendingCount > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
            <RefreshCw size={14} />
            {pendingCount} item{pendingCount !== 1 ? 's' : ''} pending sync
          </div>
        )}

        <div className="pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-[#183a1d] bg-[#f6c453] hover:bg-[#f0a04b] transition-colors"
          >
            Back to Home
          </Link>
        </div>

        <p className="text-xs text-[#183a1d]/40">
          You can still add expenses while offline — they&apos;ll be automatically sealed when you reconnect.
        </p>
      </div>
    </div>
  );
}
