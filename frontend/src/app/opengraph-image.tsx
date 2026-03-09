import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Tulip DS — Blockchain Document Verification'
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
          background: 'linear-gradient(135deg, #040f1f 0%, #07224a 50%, #0c7aed 100%)',
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
              background: 'linear-gradient(135deg, #0c7aed, #004ea8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '28px',
              fontWeight: 800,
            }}
          >
            T
          </div>
          <span style={{ color: 'white', fontSize: '48px', fontWeight: 800 }}>
            tulip
            <span style={{ color: '#369bff' }}>ds</span>
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
            color: '#94a3b8',
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
