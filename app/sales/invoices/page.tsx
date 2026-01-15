import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { InvoiceList } from '@/components/sales/invoice-list'
import { PageHeader } from '@/components/ui/page-header'
import { Receipt } from 'lucide-react'

export default async function InvoicesPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Facturas"
          description="Emite, cobra e imprime. Incluye estado y soporte para facturación electrónica."
          icon={<Receipt className="h-5 w-5" />}
        />
        
        <InvoiceList />
      </div>
    </MainLayout>
  )
}
