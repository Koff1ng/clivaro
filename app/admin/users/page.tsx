import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UserList } from '@/components/admin/user-list'
import { PageHeader } from '@/components/ui/page-header'
import { UserCog } from 'lucide-react'

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  
  if (!session) {
    redirect('/login')
  }

  const userPermissions = (session.user as any).permissions || []
  
  if (!userPermissions.includes('manage_users')) {
    redirect('/dashboard')
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Usuarios"
          description="Administra accesos, roles y permisos con control por perfil."
          icon={<UserCog className="h-5 w-5" />}
        />
        <UserList />
      </div>
    </MainLayout>
  )
}

