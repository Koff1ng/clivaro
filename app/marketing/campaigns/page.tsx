import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PlanGuard } from '@/components/guards/plan-guard'
import MarketingHub from '@/components/marketing/marketing-hub'

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <PlanGuard featureKey="marketing" featureLabel="Campañas de Marketing" requiredPlan="Business">
        <MarketingHub />
      </PlanGuard>
    </MainLayout>
  )
}
