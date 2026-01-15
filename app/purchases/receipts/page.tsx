import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ReceiptList } from '@/components/purchases/receipt-list'
import { PageHeader } from '@/components/ui/page-header'
import { PackageCheck } from 'lucide-react'

export default async function ReceiptsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Recepciones"
          description="Recibe mercancía, registra movimientos y actualiza stock en tiempo real."
          icon={<PackageCheck className="h-5 w-5" />}
        />
        
        <ReceiptList />
      </div>
    </MainLayout>
  )
}

