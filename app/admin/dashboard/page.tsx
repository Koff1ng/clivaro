import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { AdminDashboard } from '@/components/admin/admin-dashboard'

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Verify super admin
  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { isSuperAdmin: true }
  })

  if (!user?.isSuperAdmin) {
    redirect('/dashboard')
  }

  return (
    <MainLayout>
      <AdminDashboard />
    </MainLayout>
  )
}
