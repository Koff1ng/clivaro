import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SupplierList } from '@/components/purchases/supplier-list'
import { PageHeader } from '@/components/ui/page-header'
import { Building2 } from 'lucide-react'

export default async function SuppliersPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Proveedores"
          description="Centraliza contactos, condiciones y compras por proveedor para mejores decisiones."
          icon={<Building2 className="h-5 w-5" />}
        />
        
        <SupplierList />
      </div>
    </MainLayout>
  )
}
