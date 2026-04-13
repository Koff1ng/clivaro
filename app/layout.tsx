import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { ToastContainer } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Providers } from './providers'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/react'
import { FacebookPixel } from '@/components/analytics/facebook-pixel'

const sfPro = localFont({
  src: [
    {
      path: '../fonts/San-Francisco-Pro-Fonts-master/San-Francisco-Pro-Fonts-master/SF-Pro-Display-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/San-Francisco-Pro-Fonts-master/San-Francisco-Pro-Fonts-master/SF-Pro-Display-Medium.otf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/San-Francisco-Pro-Fonts-master/San-Francisco-Pro-Fonts-master/SF-Pro-Display-Semibold.otf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../fonts/San-Francisco-Pro-Fonts-master/San-Francisco-Pro-Fonts-master/SF-Pro-Display-Bold.otf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-sf-pro',
  display: 'swap',
})

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Clivaro',
  description: 'Sistema de gestion empresarial',
  icons: {
    icon: '/LOGO FINAL.svg',
    shortcut: '/LOGO FINAL.svg',
    apple: '/LOGO FINAL.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${sfPro.variable} ${plusJakartaSans.variable} font-sans antialiased bg-background text-foreground selection:bg-primary/10 selection:text-primary`}
      >
        <FacebookPixel />

        <ErrorBoundary>
          <Providers>
            {children}
          </Providers>
          <ToastContainer />
        </ErrorBoundary>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  )
}
