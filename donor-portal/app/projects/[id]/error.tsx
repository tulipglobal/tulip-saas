'use client'

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="rounded-xl border px-6 py-8" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
        <h2 className="text-lg font-bold mb-2" style={{ color: '#DC2626' }}>Something went wrong</h2>
        <pre className="text-sm mb-4 whitespace-pre-wrap overflow-auto max-h-60 rounded-lg p-3"
          style={{ background: '#FFF', color: 'var(--donor-dark)', border: '1px solid var(--donor-border)' }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
        <button onClick={reset}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--donor-accent)' }}>
          Try again
        </button>
      </div>
    </div>
  )
}
