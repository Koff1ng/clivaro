import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const createUserSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(50, 'El nombre de usuario no puede exceder 50 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  name: z.string().min(1, 'El nombre es requerido'),
  active: z.boolean().default(true),
  roleIds: z.array(z.string()).min(1, 'Debe asignar al menos un rol'),
})

const updateUserSchema = z.object({
  email: z.string().email('Email inválido').optional(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  active: z.boolean().optional(),
  roleIds: z.array(z.string()).optional(),
})

export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)

  if (session instanceof NextResponse) {
    return session
  }

  const tenantId = getTenantIdFromSession(session)

  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const users = await withTenantTx(tenantId, async (tx) => {
      return await tx.user.findMany({
        where: {
          ...(includeInactive ? {} : { active: true }),
          // Extra safety: Never return global SuperAdmins in tenant context
          // In a proper tenant isolation, they wouldn't even exist in this schema.
          isSuperAdmin: false,
          ...(search ? {
            OR: [
              { name: { contains: search } },
              { username: { contains: search } },
              { email: { contains: search } },
            ],
          } : {}),
        },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          active: true,
          createdAt: true,
          userRoles: {
            include: {
              role: {
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

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
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
    const data = createUserSchema.parse(body)

    const result = await withTenantTx(tenantId, async (tx) => {
      // Check if username already exists
      const existingUser = await tx.user.findUnique({
        where: { username: data.username },
      })

      if (existingUser) {
        throw new Error('El nombre de usuario ya está en uso')
      }

      // Check if email is provided and already exists
      if (data.email && data.email.trim() !== '') {
        const existingEmail = await tx.user.findUnique({
          where: { email: data.email },
        })

        if (existingEmail) {
          throw new Error('El email ya está en uso')
        }
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 10)

      // Create user with roles
      const user = await tx.user.create({
        data: {
          username: data.username,
          email: data.email && data.email.trim() !== '' ? data.email : null,
          password: hashedPassword,
          name: data.name,
          active: data.active,
          createdById: (session.user as any).id,
          userRoles: {
            create: data.roleIds.map(roleId => ({
              roleId,
            })),
          },
        },
        include: {
          userRoles: {
            include: {
              role: {
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

      return user
    })

    // Remove password from response
    const { password, ...userWithoutPassword } = result as any

    return NextResponse.json(userWithoutPassword, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    if (error.message === 'El nombre de usuario ya está en uso' || error.message === 'El email ya está en uso') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
