import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { connectMetaAccount, getMetaConfig } from '@/lib/marketing/meta-ads-service'

export const dynamic = 'force-dynamic'

// GET: Check if Meta Ads is connected for this tenant — with live health check
export async function GET(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId

  try {
    const config = await getMetaConfig(tenantId)

    // Base response (always returned even if live check fails)
    const response: Record<string, any> = {
      connected: true,
      adAccountId: config.adAccountId,
      pageId: config.pageId || null,
      hasPageId: !!config.pageId,
      tokenPreview: config.accessToken
        ? `${config.accessToken.slice(0, 6)}...${config.accessToken.slice(-4)}`
        : null,
      apiStatus: 'unknown',
      accountName: null,
      connectedAt: config.createdAt,
    }

    // Live health check — verify token is still valid by reading the ad account
    try {
      const bizSdk = require('facebook-nodejs-business-sdk')
      const { FacebookAdsApi, AdAccount } = bizSdk
      FacebookAdsApi.init(config.accessToken)
      const account = new AdAccount(config.adAccountId)
      const data = await account.read(['name', 'account_status', 'currency', 'timezone_name'])
      response.apiStatus = 'healthy'
      response.accountName = data.name || config.adAccountId
      response.currency = data.currency || null
      response.timezone = data.timezone_name || null
      response.accountStatus = data.account_status // 1 = active, 2 = disabled, etc.
    } catch (apiError: any) {
      // Token expired or API issue
      const msg = apiError?.message || ''
      if (msg.includes('expired') || msg.includes('invalid') || msg.includes('OAuthException')) {
        response.apiStatus = 'token_expired'
      } else {
        response.apiStatus = 'error'
      }
      response.apiError = msg.slice(0, 200)
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ connected: false })
  }
}

// POST: Connect Meta Ads account (store token + ad account)
export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const body = await request.json()

  if (!body.accessToken || !body.adAccountId) {
    return NextResponse.json({ error: 'accessToken y adAccountId son requeridos' }, { status: 400 })
  }

  // Validate adAccountId format
  if (!body.adAccountId.startsWith('act_')) {
    return NextResponse.json({ error: 'adAccountId debe empezar con act_' }, { status: 400 })
  }

  try {
    const config = await connectMetaAccount(tenantId, body)
    return NextResponse.json({ success: true, adAccountId: config.adAccountId })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

// PATCH: Update Page ID on existing config
export async function PATCH(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId
  const body = await request.json()

  if (!body.pageId) {
    return NextResponse.json({ error: 'pageId es requerido' }, { status: 400 })
  }

  try {
    const { prisma } = require('@/lib/db')
    await prisma.metaAdsConfig.update({
      where: { tenantId },
      data: { pageId: body.pageId },
    })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
