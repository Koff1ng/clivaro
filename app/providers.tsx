'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { useState } from 'react'
import { ThemeProvider } from '@/components/theme/theme-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30s - prefer real-time data on section entry
        gcTime: 10 * 60 * 1000, // 10 minutes - cache time (formerly cacheTime)
        refetchOnWindowFocus: true,
        refetchOnMount: 'always', // Always refetch when entering a section
        retry: 1, // Reduce retries for faster failure
      },
    },
  }))

  return (
    <ThemeProvider>
      <SessionProvider>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}

