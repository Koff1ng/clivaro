'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from 'next-auth/react'
import { useState } from 'react'
import { ThemeProvider } from '@/components/theme/theme-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Keep data reasonably fresh without causing a burst of refetches that can saturate Supabase pooler.
        staleTime: 30 * 1000, // 30s - reduced from 60s for better freshness
        gcTime: 5 * 60 * 1000, // 5 minutes - reduced cache time
        refetchOnWindowFocus: true,
        // Only refetch on mount if data is stale (prevents burst of requests on dashboard load)
        refetchOnMount: false, // Changed from true to prevent connection pool saturation
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

