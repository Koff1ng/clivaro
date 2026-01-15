import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { getPrismaForRequest } from '@/lib/get-tenant-prisma'
import { z } from 'zod'

const addRecipientsSchema = z.object({
  customerIds: z.array(z.string()).optional(),
  emails: z.array(z.string().email()).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  
  if (session instanceof NextResponse) {
    return session
  }

  // Obtener el cliente Prisma correcto (tenant o master según el usuario)
  const prisma = await getPrismaForRequest(request, session)

  try {
    const resolvedParams = typeof params === 'object' && 'then' in params 
      ? await params 
      : params as { id: string }
    const campaignId = resolvedParams.id

    const body = await request.json()
    const data = addRecipientsSchema.parse(body)

    // Get customer emails if customerIds provided
    let emailsToAdd: string[] = []
    
    if (data.customerIds && data.customerIds.length > 0) {
      const customers = await prisma.customer.findMany({
        where: {
          id: { in: data.customerIds },
          email: { not: null },
        },
        select: {
          email: true,
          id: true,
        },
      })
      
      emailsToAdd = customers
        .filter(c => c.email)
        .map(c => ({ email: c.email!, customerId: c.id }))
        .map(c => c.email)
    }

    if (data.emails) {
      emailsToAdd = [...emailsToAdd, ...data.emails]
    }

    // Remove duplicates
    emailsToAdd = [...new Set(emailsToAdd)]

    // Get existing recipients to avoid duplicates
    const existingRecipients = await prisma.marketingCampaignRecipient.findMany({
      where: {
        campaignId,
        email: { in: emailsToAdd },
      },
      select: { email: true },
    })

    const existingEmails = new Set(existingRecipients.map(r => r.email))
    const newEmails = emailsToAdd.filter(email => !existingEmails.has(email))

    // Get customer IDs for emails
    const customersMap = new Map<string, string>()
    if (data.customerIds) {
      const customers = await prisma.customer.findMany({
        where: {
          id: { in: data.customerIds },
        },
        select: {
          id: true,
          email: true,
        },
      })
      customers.forEach(c => {
        if (c.email) {
          customersMap.set(c.email, c.id)
        }
      })
    }

    // Create recipients
    const recipients = await prisma.marketingCampaignRecipient.createMany({
      data: newEmails.map(email => ({
        campaignId,
        customerId: customersMap.get(email) || null,
        email,
        status: 'PENDING',
      })),
    })

    return NextResponse.json({
      added: recipients.count,
      total: newEmails.length,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error adding recipients:', error)
    return NextResponse.json(
      { error: 'Failed to add recipients' },
      { status: 500 }
    )
  }
}

