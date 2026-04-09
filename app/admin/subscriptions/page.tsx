import { AdminLayout } from '@/components/layout/admin-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { SubscriptionsClient } from '@/components/admin/subscriptions-client'

export const dynamic = 'force-dynamic'

export default async function SubscriptionsPage() {
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
      <SubscriptionsClient />
    </AdminLayout>
  )
}
