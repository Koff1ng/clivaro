import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const user = await prisma.user.findUnique({
      where: { id: (session.user as any).id },
      select: { isSuperAdmin: true }
    })
    if (!user?.isSuperAdmin) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const action = url.searchParams.get('action') || undefined
    const search = url.searchParams.get('search') || undefined

    const where: any = {}
    if (action) where.action = action
    if (search) {
      where.OR = [
        { adminUserName: { contains: search, mode: 'insensitive' } },
        { targetTenantName: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [logs, total] = await Promise.all([
      (prisma as any).adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (prisma as any).adminAuditLog.count({ where }),
    ])

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error: any) {
    logger.error('Error fetching audit logs:', error)
    // If table doesn't exist yet, return empty
    return NextResponse.json({ logs: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } })
  }
}
