import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastContainer } from '@/components/ui/toast'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

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
      <body className={inter.className}>
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
