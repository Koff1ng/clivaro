'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { AlertTriangle, X, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Banner that appears at the top of the screen when a Super Admin
 * is impersonating a tenant's session. Shows a warning and a button
 * to end the impersonation.
 */
export function ImpersonationBanner() {
  const { data: session } = useSession()
  const [dismissed, setDismissed] = useState(false)

  const isImpersonating = (session?.user as any)?.isImpersonating === true
  const impersonatedTenant = (session?.user as any)?.impersonatedTenantName
  const superAdminName = (session?.user as any)?.impersonatedBy

  if (!isImpersonating || dismissed) return null

  const handleEndImpersonation = () => {
    // Clear the impersonation session and redirect to admin panel
    window.location.href = '/admin/tenants'
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-red-600 via-red-500 to-orange-500 text-white shadow-lg print:hidden">
      <div className="flex items-center justify-between px-4 py-2 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white/15 rounded-full px-3 py-1">
            <Eye className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Impersonación</span>
          </div>
          <span className="text-sm font-medium">
            Estás viendo el ERP de <strong>{impersonatedTenant}</strong>
            {superAdminName && <span className="opacity-80"> · Ejecutado por {superAdminName}</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleEndImpersonation}
            size="sm"
            className="bg-white/20 hover:bg-white/30 text-white text-xs h-7 px-3 border border-white/30"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Volver al Panel Admin
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
