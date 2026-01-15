import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LeadList } from '@/components/crm/lead-list'
import { PlanGuard } from '@/components/guards/plan-guard'
import { PageHeader } from '@/components/ui/page-header'
import { Target } from 'lucide-react'

export default async function LeadsPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Oportunidades"
          description="Visualiza tu pipeline, prioriza por probabilidad y convierte más oportunidades en ventas."
          icon={<Target className="h-5 w-5" />}
        />

        <PlanGuard featureKey="leads" featureLabel="Oportunidades (CRM)" requiredPlan="Business">
          <LeadList />
        </PlanGuard>
      </div>
    </MainLayout>
  )
}
