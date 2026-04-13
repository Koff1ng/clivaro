import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'

const createRoleSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).min(1, 'Debe seleccionar al menos un permiso'),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = getTenantIdFromSession(session)

  try {
    const roles = await withTenantTx(tenantId, async (tx) => {
      return await tx.role.findMany({
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
        orderBy: { name: 'asc' },
      })
    })

    return NextResponse.json({ roles })
  } catch (error) {
    logger.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = getTenantIdFromSession(session)

  try {
    const body = await request.json()
    const data = createRoleSchema.parse(body)

    const result = await withTenantTx(tenantId, async (tx) => {
      // Check if role name already exists
      const existingRole = await tx.role.findUnique({
        where: { name: data.name },
      })

      if (existingRole) {
        throw new Error('Ya existe un rol con ese nombre')
      }

      // Create role and its permissions
      return await tx.role.create({
        data: {
          name: data.name,
          description: data.description,
          rolePermissions: {
            create: data.permissionIds.map(permissionId => ({
              permissionId,
            })),
          },
        },
      })
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    if (error.message === 'Ya existe un rol con ese nombre') {
      return NextResponse.json({ error: safeErrorMessage(error) }, { status: 400 })
    }

    logger.error('Error creating role:', error)
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    )
  }
}

