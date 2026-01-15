import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CustomerList } from '@/components/crm/customer-list'
import { PageHeader } from '@/components/ui/page-header'
import { Users } from 'lucide-react'

export default async function CustomersPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Clientes"
          description="Centraliza contactos, historial de compras y seguimiento comercial en un solo lugar."
          icon={<Users className="h-5 w-5" />}
        />
        
        <CustomerList />
      </div>
    </MainLayout>
  )
}
