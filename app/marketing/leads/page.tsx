import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PlanGuard } from '@/components/guards/plan-guard'
import { LeadList } from '@/components/crm/lead-list'
import { PageHeader } from '@/components/ui/page-header'
import { Target } from 'lucide-react'

export default async function LeadsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <MainLayout>
      <PlanGuard featureKey="marketing" featureLabel="Oportunidades" requiredPlan="Business">
        <div className="space-y-4">
          <PageHeader
            title="Oportunidades"
            description="Pipeline de ventas y leads."
            icon={<Target className="h-5 w-5" />}
          />
          <LeadList />
        </div>
      </PlanGuard>
    </MainLayout>
  )
}
