import { Geist } from "next/font/google"
import "./globals.css"
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import ClientLayout from './ClientLayout'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <head>
        <title>Sealayer — Donor Portal</title>
        <meta name="description" content="Sealayer Donor Portal — View your funded projects" />
      </head>
      <body className={`${geistSans.variable} antialiased`} style={{ background: 'var(--background)' }}>
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t=localStorage.getItem('tulip_donor_theme')||'system';
            if(t==='system'){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'}
            document.documentElement.setAttribute('data-theme',t);
          })()
        ` }} />
        <NextIntlClientProvider messages={messages}>
          <ClientLayout>{children}</ClientLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
