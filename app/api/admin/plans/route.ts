import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }


  const user = session.user as any
    
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

    const plans = await prisma.plan.findMany({
      orderBy: {
        price: 'asc'
      }
    })

    return NextResponse.json(plans)
  } catch (error: any) {
    console.error('Error fetching plans:', error)
    return NextResponse.json(
      { error: error.message || 'Error al obtener planes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request)
    
    if (session instanceof NextResponse) {
      return session
    }


  const user = session.user as any
    
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
    const { name, description, price, currency, interval, features, active } = body

    const plan = await prisma.plan.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        currency: currency || 'COP',
        interval,
        features: features ? JSON.stringify(features) : null,
        active: active !== undefined ? active : true
      }
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error: any) {
    console.error('Error creating plan:', error)
    return NextResponse.json(
      { error: error.message || 'Error al crear plan' },
      { status: 500 }
    )
  }
}


