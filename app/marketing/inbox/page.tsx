import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PlanGuard } from '@/components/guards/plan-guard'
import MarketingInbox from '@/components/marketing/marketing-inbox'
import { PageHeader } from '@/components/ui/page-header'
import { Inbox } from 'lucide-react'

export default async function InboxPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  return (
    <MainLayout>
      <PlanGuard featureKey="marketing" featureLabel="Inbox" requiredPlan="Business">
        <div className="space-y-4">
          <PageHeader
            title="Inbox"
            description="Contactos y correo entrante."
            icon={<Inbox className="h-5 w-5" />}
          />
          <MarketingInbox />
        </div>
      </PlanGuard>
    </MainLayout>
  )
}
