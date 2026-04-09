import { AdminLayout } from '@/components/layout/admin-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { FeatureFlagsClient } from '@/components/admin/feature-flags-client'

export const dynamic = 'force-dynamic'

export default async function FeatureFlagsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: (session.user as any).id },
    select: { isSuperAdmin: true }
  })

  if (!user?.isSuperAdmin) {
    redirect('/dashboard')
  }

  return (
    <AdminLayout>
      <FeatureFlagsClient />
    </AdminLayout>
  )
}
