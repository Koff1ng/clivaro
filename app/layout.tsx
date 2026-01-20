import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'
import { ToastContainer } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Providers } from './providers'

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal'],
})

export const metadata: Metadata = {
  title: 'ClientumExpress',
  description: 'Sistema de gestion empresarial',
  icons: {
    icon: '/clivaro-logo.webp',
    shortcut: '/clivaro-logo.webp',
    apple: '/clivaro-logo.webp',
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
        className={`${fontSans.className} antialiased bg-background text-foreground selection:bg-primary/10 selection:text-primary`}
      >
        <ErrorBoundary>
          <Providers>
            {children}
          </Providers>
          <ToastContainer />
        </ErrorBoundary>
      </body>
    </html>
  )
}
