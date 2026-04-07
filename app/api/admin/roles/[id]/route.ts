import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateRoleSchema = z.object({
    name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
    description: z.string().optional(),
    permissionIds: z.array(z.string()).optional(),
})

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

    if (session instanceof NextResponse) {
        return session
    }

    const tenantId = getTenantIdFromSession(session)
    const { id } = params

    try {
        const role = await withTenantTx(tenantId, async (tx) => {
            return await tx.role.findUnique({
                where: { id },
                include: {
                    rolePermissions: {
                        include: {
                            permission: {
                                select: {
                                    id: true,
                                    name: true,
                                    description: true,
                                },
                            },
                        },
                    },
                },
            })
        })

        if (!role) {
            return NextResponse.json({ error: 'Rol no encontrado' }, { status: 404 })
        }

        return NextResponse.json({ role })
    } catch (error) {
        logger.error('Error fetching role:', error)
        return NextResponse.json(
            { error: 'Failed to fetch role' },
            { status: 500 }
        )
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

    if (session instanceof NextResponse) {
        return session
    }

    const tenantId = getTenantIdFromSession(session)
    const { id } = params

    try {
        const body = await request.json()
        const data = updateRoleSchema.parse(body)

        const result = await withTenantTx(tenantId, async (tx) => {
            // Check if role exists
            const existingRole = await tx.role.findUnique({
                where: { id },
            })

            if (!existingRole) {
                throw new Error('Rol no encontrado')
            }

            // If name is changing, check for duplicates
            if (data.name && data.name !== existingRole.name) {
                const duplicate = await tx.role.findUnique({
                    where: { name: data.name },
                })
                if (duplicate) {
                    throw new Error('Ya existe un rol con ese nombre')
                }
            }

            // Update role and its permissions
            return await tx.role.update({
                where: { id },
                data: {
                    name: data.name,
                    description: data.description,
                    ...(data.permissionIds && {
                        rolePermissions: {
                            deleteMany: {}, // Clear existing
                            create: data.permissionIds.map(permissionId => ({
                                permissionId,
                            })),
                        },
                    }),
                },
            })
        })

        return NextResponse.json(result)
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation error', details: error.errors },
                { status: 400 }
            )
        }

        if (error.message === 'Rol no encontrado') {
            return NextResponse.json({ error: error.message }, { status: 404 })
        }

        if (error.message === 'Ya existe un rol con ese nombre') {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        logger.error('Error updating role:', error)
        return NextResponse.json(
            { error: 'Failed to update role' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: { id: string } }
) {
    const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

    if (session instanceof NextResponse) {
        return session
    }

    const tenantId = getTenantIdFromSession(session)
    const { id } = params

    try {
        await withTenantTx(tenantId, async (tx) => {
            // Check if role is assigned to any users
            const usersWithRole = await tx.userRole.count({
                where: { roleId: id },
            })

            if (usersWithRole > 0) {
                throw new Error('No se puede eliminar el rol porque tiene usuarios asignados')
            }

            // Check if it's a protected role (optional, but good for safety)
            const role = await tx.role.findUnique({ where: { id } })
            if (role?.name === 'ADMIN') {
                throw new Error('No se puede eliminar el rol ADMINISTRADOR')
            }

            return await tx.role.delete({
                where: { id },
            })
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        if (
            error.message === 'No se puede eliminar el rol porque tiene usuarios asignados' ||
            error.message === 'No se puede eliminar el rol ADMINISTRADOR'
        ) {
            return NextResponse.json({ error: error.message }, { status: 400 })
        }

        logger.error('Error deleting role:', error)
        return NextResponse.json(
            { error: 'Failed to delete role' },
            { status: 500 }
        )
    }
}
