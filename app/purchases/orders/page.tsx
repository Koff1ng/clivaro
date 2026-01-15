import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PurchaseOrderList } from '@/components/purchases/purchase-order-list'
import { PageHeader } from '@/components/ui/page-header'
import { ShoppingBag } from 'lucide-react'

export default async function PurchaseOrdersPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Órdenes de compra"
          description="Planifica compras, controla estados y enlaza recepciones para actualizar inventario."
          icon={<ShoppingBag className="h-5 w-5" />}
        />
        
        <PurchaseOrderList />
      </div>
    </MainLayout>
  )
}

