'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface CallOverlayProps {
  callerName: string
  isIncoming: boolean
  isActive: boolean
  onAccept: () => void
  onDecline: () => void
  onEnd: () => void
  stream: MediaStream | null
}

export default function CallOverlay({ callerName, isIncoming, isActive, onAccept, onDecline, onEnd, stream }: CallOverlayProps) {
  const [elapsed, setElapsed] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!isActive) { setElapsed(0); return }
    const t = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(t)
  }, [isActive])

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream
      audioRef.current.play().catch(() => {})
    }
  }, [stream])

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // Incoming call overlay — fullscreen
  if (isIncoming && !isActive) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: 'rgba(38,33,92,0.95)' }}>
        <audio ref={audioRef} autoPlay />
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'var(--donor-accent)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </div>
        <p className="text-white text-2xl font-bold mb-2">{callerName}</p>
        <p className="text-white/60 text-sm mb-10">Incoming call...</p>
        <div className="flex items-center gap-8">
          <button onClick={onDecline} className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-105" style={{ background: '#DC2626' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91" />
              <line x1="23" y1="1" x2="1" y2="23" />
            </svg>
          </button>
          <button onClick={onAccept} className="w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-105" style={{ background: '#16A34A' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Active call — minimized bar at top
  if (isActive) {
    return (
      <>
        <audio ref={audioRef} autoPlay />
        <div className="fixed top-0 left-0 right-0 z-[100] h-10 flex items-center justify-center gap-4 text-white text-sm font-medium" style={{ background: '#16A34A' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
          <span>On call with {callerName} — {fmtTime(elapsed)}</span>
          <button onClick={onEnd} className="px-3 py-1 rounded-full text-xs font-bold hover:opacity-90 transition-opacity" style={{ background: '#DC2626' }}>
            End call
          </button>
        </div>
      </>
    )
  }

  return null
}
