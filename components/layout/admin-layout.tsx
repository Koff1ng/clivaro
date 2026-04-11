'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Sidebar } from './sidebar'
import { AdminHeader } from './admin-header'
import { SidebarProvider } from '@/lib/sidebar-context'

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#f7f7f8]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <AdminHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto px-4 py-4 sm:px-6 sm:py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/admin/login')
    } else if (status === 'authenticated') {
      const isSuperAdmin = (session?.user as any)?.isSuperAdmin
      if (!isSuperAdmin) {
        router.push('/dashboard')
      }
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#10a37f] border-t-transparent animate-spin" />
          <span className="text-sm text-[#6e6e80]">Verificando acceso...</span>
        </div>
      </div>
    )
  }

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin
  if (!session || !isSuperAdmin) {
    return null
  }

  return (
    <SidebarProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SidebarProvider>
  )
}

