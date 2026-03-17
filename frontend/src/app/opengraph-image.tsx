import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Sealayer — Blockchain Document Verification'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #183a1d 0%, #2d5a27 50%, #f6c453 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              background: 'var(--tulip-gold)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--tulip-forest)',
              fontSize: '28px',
              fontWeight: 800,
            }}
          >
            T
          </div>
          <span style={{ color: 'white', fontSize: '48px', fontWeight: 800 }}>
            tulip
            <span style={{ color: 'var(--tulip-gold)' }}>ds</span>
          </span>
        </div>
        <div
          style={{
            color: 'white',
            fontSize: '40px',
            fontWeight: 800,
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.2,
          }}
        >
          Every Document. Blockchain Verified. Forever.
        </div>
        <div
          style={{
            color: 'var(--tulip-sage)',
            fontSize: '20px',
            marginTop: '20px',
            textAlign: 'center',
          }}
        >
          Polygon Anchored · RFC 3161 Timestamped · GDPR Compliant
        </div>
      </div>
    ),
    { ...size }
  )
}
