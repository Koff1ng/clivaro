import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

const updateUserSchema = z.object({
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').max(50, 'El nombre de usuario no puede exceder 50 caracteres').optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
  name: z.string().min(1, 'El nombre es requerido').optional(),
  active: z.boolean().optional(),
  roleIds: z.array(z.string()).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_USERS)
  
  if (session instanceof NextResponse) {
    return session
  }

  try {
    const db = await getPrismaForRequest(request, session)
    const user = await db.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        active: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                description: true,
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
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
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

  try {
    const db = await getPrismaForRequest(request, session)
    const body = await request.json()
    const data = updateUserSchema.parse(body)

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Check if username is being changed and if it's already in use
    if (data.username && data.username !== existingUser.username) {
      const usernameInUse = await db.user.findUnique({
        where: { username: data.username },
      })

      if (usernameInUse) {
        return NextResponse.json(
          { error: 'El nombre de usuario ya está en uso' },
          { status: 400 }
        )
      }
    }

    // Check if email is being changed and if it's already in use
    const emailToSet = data.email && data.email.trim() !== '' ? data.email : null
    if (emailToSet !== existingUser.email) {
      if (emailToSet) {
        const emailInUse = await db.user.findUnique({
          where: { email: emailToSet },
        })

        if (emailInUse) {
          return NextResponse.json(
            { error: 'El email ya está en uso' },
            { status: 400 }
          )
        }
      }
    }

    // Prepare update data
    const updateData: any = {}
    if (data.username !== undefined) updateData.username = data.username
    if (data.name !== undefined) updateData.name = data.name
    if (data.email !== undefined) {
      updateData.email = data.email && data.email.trim() !== '' ? data.email : null
    }
    if (data.active !== undefined) updateData.active = data.active
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }
    updateData.updatedById = (session.user as any).id

    // Update user and roles in a transaction
    const user = await db.$transaction(async (tx) => {
      // Update user
      const updatedUser = await tx.user.update({
        where: { id: params.id },
        data: updateData,
      })

      // Update roles if provided
      if (data.roleIds !== undefined) {
        // Delete existing roles
        await tx.userRole.deleteMany({
          where: { userId: params.id },
        })

        // Create new roles
        if (data.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: data.roleIds.map(roleId => ({
              userId: params.id,
              roleId,
            })),
          })
        }
      }

      // Fetch updated user with roles
      return await tx.user.findUnique({
        where: { id: params.id },
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
    })

    // Remove password from response
    const { password, ...userWithoutPassword } = user!

    return NextResponse.json(userWithoutPassword)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
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

  try {
    const db = await getPrismaForRequest(request, session)
    // Check if user exists
    const user = await db.user.findUnique({
      where: { id: params.id },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      )
    }

    // Prevent deleting yourself
    if (user.id === (session.user as any).id) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propio usuario' },
        { status: 400 }
      )
    }

    // Soft delete: set active to false instead of deleting
    await db.user.update({
      where: { id: params.id },
      data: { active: false, updatedById: (session.user as any).id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}

