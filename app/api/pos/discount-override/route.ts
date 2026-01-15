import { NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_SALES)
  if (session instanceof NextResponse) return session

  const prisma = await getPrismaForRequest(request, session)

  try {
    const body = await request.json()
    const { username, password } = schema.parse(body)

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email: username }],
        active: true,
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const perms = new Set<string>()
    const roles = new Set<string>()
    for (const ur of user.userRoles) {
      roles.add(ur.role.name)
      for (const rp of ur.role.rolePermissions) {
        perms.add(rp.permission.name)
      }
    }

    const canOverride =
      perms.has(PERMISSIONS.APPLY_DISCOUNTS) ||
      perms.has(PERMISSIONS.MANAGE_USERS) ||
      roles.has('ADMIN') ||
      roles.has('MANAGER') ||
      (user as any).isSuperAdmin

    if (!canOverride) {
      return NextResponse.json({ error: 'El usuario no tiene permisos para autorizar descuentos' }, { status: 403 })
    }

    const secret = process.env.NEXTAUTH_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Server misconfigured (NEXTAUTH_SECRET)' }, { status: 500 })
    }

    const issuedForUserId = (session.user as any).id as string
    const token = jwt.sign(
      {
        aud: 'pos-discount-override',
        perm: PERMISSIONS.APPLY_DISCOUNTS,
        authorizedUserId: user.id,
        authorizedUserName: user.name,
        issuedForUserId,
      },
      secret,
      {
        expiresIn: '5m',
        issuer: 'clivaro',
      }
    )

    return NextResponse.json({
      token,
      authorizedBy: { id: user.id, name: user.name },
      expiresInSeconds: 5 * 60,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Error de validación', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: error.message || 'Error al autorizar descuento' }, { status: 500 })
  }
}


