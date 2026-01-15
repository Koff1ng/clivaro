import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InventoryTabs } from '@/components/inventory/inventory-tabs'
import { PageHeader } from '@/components/ui/page-header'
import { PageHeaderBadges } from '@/components/ui/page-header-badges'
import { Warehouse } from 'lucide-react'

export default async function InventoryPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Inventario"
          description="Controla existencias, movimientos y ajustes con trazabilidad por almacén."
          icon={<Warehouse className="h-5 w-5" />}
          breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Inventario' }]}
          badges={<PageHeaderBadges />}
        />
        
        <InventoryTabs />
      </div>
    </MainLayout>
  )
}
