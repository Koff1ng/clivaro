import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { withTenantTx } from '@/lib/tenancy'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/tenants/[id]/reset-credentials
 * Resets the admin user password in the tenant schema back to Admin123!
 * and ensures the ADMIN role + permissions are seeded.
 * Only accessible by super admins.
 */
export async function POST(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions)
        const user = session?.user as any

        if (!user?.isSuperAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const tenant = await prisma.tenant.findUnique({
            where: { id: params.id },
            select: { id: true, name: true, slug: true, databaseUrl: true }
        })

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
        }

        const newPassword = 'Admin123!'
        const hashedPassword = await bcrypt.hash(newPassword, 10)

        await withTenantTx(tenant.id, async (tx: any) => {
            // 1. Upsert admin user with reset password
            const adminUser = await tx.user.upsert({
                where: { username: 'admin' },
                update: { password: hashedPassword, active: true, forcePasswordChange: true },
                create: {
                    username: 'admin',
                    password: hashedPassword,
                    name: 'Administrador',
                    active: true,
                    isSuperAdmin: false,
                    forcePasswordChange: true,
                },
            })

            // 2. Upsert ADMIN role
            const adminRole = await tx.role.upsert({
                where: { name: 'ADMIN' },
                update: {},
                create: { name: 'ADMIN', description: 'Administrador con acceso total' },
            })

            // 3. Seed core permissions
            const corePermissions = [
                'view_reports', 'manage_sales', 'manage_products', 'manage_inventory',
                'manage_customers', 'manage_suppliers', 'manage_purchases', 'manage_users',
                'manage_settings', 'view_dashboard', 'manage_pos',
            ]

            for (const permName of corePermissions) {
                const perm = await tx.permission.upsert({
                    where: { name: permName },
                    update: {},
                    create: { name: permName, description: permName },
                })
                await tx.rolePermission.upsert({
                    where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
                    update: {},
                    create: { roleId: adminRole.id, permissionId: perm.id },
                })
            }

            // 4. Assign ADMIN role to admin user
            await tx.userRole.upsert({
                where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
                update: {},
                create: { userId: adminUser.id, roleId: adminRole.id },
            })
        })

        // 5. Sync the new password to the public Tenant record for super-admin visibility
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: { adminPassword: newPassword }
        })

        return NextResponse.json({
            success: true,
            message: 'Credenciales restablecidas exitosamente',
            credentials: {
                username: 'admin',
                password: newPassword,
                loginUrl: `/login/${tenant.slug}`,
            }
        })
    } catch (error: any) {
        console.error('[RESET-CREDENTIALS]', error)
        return NextResponse.json(
            { error: 'Error al restablecer credenciales', details: error?.message || String(error) },
            { status: 500 }
        )
    }
}
