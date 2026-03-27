import { MainLayout } from '@/components/layout/main-layout'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { RoleList } from '@/components/admin/role-list'
import { PageHeader } from '@/components/ui/page-header'
import { ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RolesPage() {
    const session = await getServerSession(authOptions)

    if (!session) {
        redirect('/login')
    }

    const userPermissions = (session.user as any).permissions || []

    // Reuse manage_users permission for role management
    if (!userPermissions.includes('manage_users')) {
        redirect('/dashboard')
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                <PageHeader
                    title="Gestión de Roles"
                    description="Crea y personaliza roles con permisos específicos para tu comercio."
                    icon={<ShieldCheck className="h-5 w-5" />}
                />
                <RoleList />
            </div>
        </MainLayout>
    )
}
