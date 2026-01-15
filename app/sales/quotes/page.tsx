import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { QuotationList } from '@/components/sales/quotation-list'
import { PlanGuard } from '@/components/guards/plan-guard'
import { PageHeader } from '@/components/ui/page-header'
import { FileCheck } from 'lucide-react'

export default async function QuotesPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Cotizaciones"
          description="Crea presupuestos rápidos, envíalos por email y conviértelos en factura en un click."
          icon={<FileCheck className="h-5 w-5" />}
        />

        <PlanGuard featureKey="quotations" featureLabel="Cotizaciones" requiredPlan="Business">
          <QuotationList />
        </PlanGuard>
      </div>
    </MainLayout>
  )
}
