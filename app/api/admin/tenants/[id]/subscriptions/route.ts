import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)

    if (session instanceof NextResponse) {
      return session
    }


    const user = session.user as any
    const { id } = await params

    // Verificar si es super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const subscriptions = await prisma.subscription.findMany({
      where: { tenantId: id },
      include: {
        plan: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(subscriptions)
  } catch (error: any) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener suscripciones' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)

    if (session instanceof NextResponse) {
      return session
    }


    const user = session.user as any
    const { id } = await params

    // Verificar si es super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { planId, startDate, endDate, trialEndDate, status, autoRenew } = body

    if (!planId) {
      return NextResponse.json(
        { error: 'planId is required' },
        { status: 400 }
      )
    }

    const planExists = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } })
    if (!planExists) {
      return NextResponse.json(
        { error: 'Plan no encontrado. Recargue la página y seleccione un plan válido.' },
        { status: 400 }
      )
    }

    // Use upsert to handle the unique constraint on tenantId
    const subscription = await prisma.subscription.upsert({
      where: {
        tenantId: id,
      },
      update: {
        planId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        trialEndDate: trialEndDate ? new Date(trialEndDate) : null,
        status: status || 'active',
        autoRenew: autoRenew !== undefined ? autoRenew : true
      },
      create: {
        tenantId: id,
        planId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        trialEndDate: trialEndDate ? new Date(trialEndDate) : null,
        status: status || 'active',
        autoRenew: autoRenew !== undefined ? autoRenew : true
      },
      include: {
        plan: true
      }
    })

    return NextResponse.json(subscription, { status: 201 })
  } catch (error: any) {
    console.error('Error creating subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear suscripción' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request)

    if (session instanceof NextResponse) {
      return session
    }

    const user = session.user as any
    const { id } = await params

    // Verificar si es super admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { isSuperAdmin: true }
    })

    if (!dbUser?.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized - Super admin access required' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { subscriptionId, planId, startDate, endDate, status, autoRenew } = body

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'subscriptionId is required' },
        { status: 400 }
      )
    }

    // Si se está cambiando a un nuevo plan, actualizar la suscripción existente
    if (planId) {
      // Actualizar la suscripción existente con el nuevo plan
      const subscription = await prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          planId,
          ...(startDate && { startDate: new Date(startDate) }),
          ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
          status: status || 'active',
          ...(autoRenew !== undefined && { autoRenew })
        },
        include: {
          plan: true
        }
      })

      return NextResponse.json(subscription)
    }

    // Actualizar la suscripción existente
    const subscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        ...(planId && { planId }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(status && { status }),
        ...(autoRenew !== undefined && { autoRenew })
      },
      include: {
        plan: true
      }
    })

    return NextResponse.json(subscription)
  } catch (error: any) {
    console.error('Error updating subscription:', error)
    return NextResponse.json(
      { error: error.message || 'Error al actualizar suscripción' },
      { status: 500 }
    )
  }
}


