import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import { PageHeaderBadges } from '@/components/ui/page-header-badges'
import { DashboardGreeting } from '@/components/dashboard/greeting'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const userPermissions = (session.user as any).permissions || []
  const isSuperAdmin = (session.user as any).isSuperAdmin || false
  const tenantId = (session.user as any).tenantId

  if (!isSuperAdmin && !tenantId && !userPermissions.includes('view_reports') && !userPermissions.includes('manage_sales')) {
    redirect('/login')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          badges={<PageHeaderBadges />}
        />

        <DashboardGreeting />

        {/* All dashboard content with shared period state */}
        <DashboardContent />
      </div>
    </MainLayout>
  )
}
