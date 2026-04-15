import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PlanGuard } from '@/components/guards/plan-guard'
import MetaAdsClient from '@/components/marketing/meta-ads-client'
import { PageHeader } from '@/components/ui/page-header'
import { Radio } from 'lucide-react'

export default async function MetaAdsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <MainLayout>
      <PlanGuard featureKey="marketing" featureLabel="Meta Ads" requiredPlan="Business">
        <div className="space-y-4">
          <PageHeader
            title="Meta Ads"
            description="Gestiona tus campañas de Facebook e Instagram."
            icon={<Radio className="h-5 w-5 text-blue-600" />}
          />
          <MetaAdsClient />
        </div>
      </PlanGuard>
    </MainLayout>
  )
}
