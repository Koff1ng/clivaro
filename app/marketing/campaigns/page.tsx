import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CampaignsClient from '@/components/marketing/campaigns-client'
import { PlanGuard } from '@/components/guards/plan-guard'

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <PlanGuard featureKey="marketing" featureLabel="Campañas de Marketing" requiredPlan="Business">
        <div className="space-y-6">
          <CampaignsClient />
        </div>
      </PlanGuard>
    </MainLayout>
  )
}
