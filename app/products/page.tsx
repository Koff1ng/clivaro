import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProductsList } from '@/components/products/list'
import { PageHeader } from '@/components/ui/page-header'
import { PageHeaderBadges } from '@/components/ui/page-header-badges'
import { Package } from 'lucide-react'

export default async function ProductsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Productos"
          description="Crea, organiza y controla tu catálogo con precios, impuestos y categorías."
          icon={<Package className="h-5 w-5" />}
          breadcrumbs={[{ label: 'Inicio', href: '/dashboard' }, { label: 'Productos' }]}
          badges={<PageHeaderBadges />}
        />
        <ProductsList />
      </div>
    </MainLayout>
  )
}

