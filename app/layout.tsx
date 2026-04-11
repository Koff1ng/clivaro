import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { Plus_Jakarta_Sans } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { ToastContainer } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Providers } from './providers'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/react'

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
        {/* Facebook/Meta Pixel — deferred to lazyOnload for better LCP */}
        <Script id="facebook-pixel" strategy="lazyOnload">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '26336803186005029');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=26336803186005029&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>

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
