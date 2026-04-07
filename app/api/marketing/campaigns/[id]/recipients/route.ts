import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { withTenantRead, withTenantTx, getTenantIdFromSession } from '@/lib/tenancy'
import { z } from 'zod'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

const addRecipientsSchema = z.object({
  customerIds: z.array(z.string()).optional(),
  emails: z.array(z.string().email()).optional(),
})

export async function POST(
  request: Request,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = getTenantIdFromSession(session)

  try {
    const resolvedParams = typeof params === 'object' && 'then' in params ? await params : params as { id: string }
    const campaignId = resolvedParams.id

    const body = await request.json()
    const data = addRecipientsSchema.parse(body)

    const result = await withTenantTx(tenantId, async (prisma) => {
      let emailsToAdd: string[] = []

      if (data.customerIds && data.customerIds.length > 0) {
        const customers = await prisma.customer.findMany({
          where: { id: { in: data.customerIds }, email: { not: null } },
          select: { email: true, id: true },
        })
        emailsToAdd = customers.filter(c => c.email).map(c => c.email!)
      }

      if (data.emails) emailsToAdd = [...emailsToAdd, ...data.emails]
      emailsToAdd = [...new Set(emailsToAdd)]

      const existingRecipients = await prisma.marketingCampaignRecipient.findMany({
        where: { campaignId, email: { in: emailsToAdd } },
        select: { email: true },
      })
      const existingEmails = new Set(existingRecipients.map(r => r.email))
      const newEmails = emailsToAdd.filter(email => !existingEmails.has(email))

      const customersMap = new Map<string, string>()
      if (data.customerIds) {
        const customers = await prisma.customer.findMany({
          where: { id: { in: data.customerIds } },
          select: { id: true, email: true },
        })
        customers.forEach(c => { if (c.email) customersMap.set(c.email, c.id) })
      }

      const recipients = await prisma.marketingCampaignRecipient.createMany({
        data: newEmails.map(email => ({
          campaignId,
          customerId: customersMap.get(email) || null,
          email,
          status: 'PENDING',
        })),
      })

      return recipients.count
    })

    return NextResponse.json({ added: result, total: result })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    logger.error('Error adding recipients', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
