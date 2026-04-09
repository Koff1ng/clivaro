/**
 * MetaAdsService — Core service for Facebook/Instagram Ads from Clivaro
 * 
 * Uses the official facebook-nodejs-business-sdk.
 * Follows Builder pattern for payload construction.
 * Async orchestration: publishFullCampaign returns tracking ID immediately.
 */

import { logger } from '../logger'
import { prisma } from '@/lib/db'
import { formatMetaError, isTokenExpired, buildSentryPayload } from './meta-ads-errors'
import type { MetaFullCampaignInput, MetaPublishResult, MetaConnectInput } from './meta-ads-types'

// ── SDK Imports ──
// facebook-nodejs-business-sdk uses CommonJS
const bizSdk = require('facebook-nodejs-business-sdk')
const { FacebookAdsApi, AdAccount, Campaign, AdSet, AdCreative, Ad } = bizSdk

// ── Builder: Campaign Payload ──
class CampaignPayloadBuilder {
  private payload: Record<string, any> = {}

  setName(name: string) { this.payload.name = name; return this }
  setObjective(objective: string) { this.payload.objective = objective; return this }
  setStatus(status: string) { this.payload.status = status; return this }
  setSpecialAdCategories(cats: string[]) { this.payload.special_ad_categories = cats; return this }

  build() { return this.payload }
}

// ── Builder: AdSet Payload ──
class AdSetPayloadBuilder {
  private payload: Record<string, any> = {}

  setName(name: string) { this.payload.name = name; return this }
  setCampaignId(id: string) { this.payload.campaign_id = id; return this }
  setDailyBudget(amountCents: number) { this.payload.daily_budget = amountCents; return this }
  setBillingEvent(event: string) { this.payload.billing_event = event; return this }
  setOptimizationGoal(goal: string) { this.payload.optimization_goal = goal; return this }
  setStatus(status: string) { this.payload.status = status; return this }
  
  setSchedule(start: string, end?: string) {
    this.payload.start_time = start
    if (end) this.payload.end_time = end
    return this
  }

  setTargeting(options: {
    countries: string[]
    ageMin?: number
    ageMax?: number
    genders?: number[]
    interests?: string[]
  }) {
    const targeting: Record<string, any> = {
      geo_locations: { countries: options.countries },
      age_min: options.ageMin || 18,
      age_max: options.ageMax || 65,
    }
    if (options.genders && options.genders.length > 0 && options.genders[0] !== 0) {
      targeting.genders = options.genders
    }
    if (options.interests && options.interests.length > 0) {
      targeting.flexible_spec = [{ interests: options.interests.map(id => ({ id })) }]
    }
    this.payload.targeting = targeting
    return this
  }

  build() { return this.payload }
}

// ── Helper: Map objective to optimization goal ──
function objectiveToGoal(objective: string): string {
  const map: Record<string, string> = {
    OUTCOME_AWARENESS: 'REACH',
    OUTCOME_TRAFFIC: 'LINK_CLICKS',
    OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
    OUTCOME_LEADS: 'LEAD_GENERATION',
    OUTCOME_SALES: 'OFFSITE_CONVERSIONS',
  }
  return map[objective] || 'LINK_CLICKS'
}

// ── Core Service ──

/**
 * Gets the Meta Ads configuration for a tenant.
 */
export async function getMetaConfig(tenantId: string) {
  const config = await prisma.metaAdsConfig.findUnique({ where: { tenantId } })
  if (!config) throw new Error('Cuenta de Meta Ads no conectada. Ve a Configuración → Meta Ads.')
  return config
}

/**
 * Saves Meta access token and ad account for a tenant.
 */
export async function connectMetaAccount(tenantId: string, input: MetaConnectInput) {
  // Validate token by making a simple API call
  try {
    const api = FacebookAdsApi.init(input.accessToken)
    const account = new AdAccount(input.adAccountId)
    await account.read([AdAccount.Fields.name])
  } catch (error: any) {
    const formatted = formatMetaError(error)
    throw new Error(formatted.userMessage)
  }

  return await prisma.metaAdsConfig.upsert({
    where: { tenantId },
    update: {
      accessToken: input.accessToken,
      adAccountId: input.adAccountId,
      pageId: input.pageId || null,
    },
    create: {
      tenantId,
      accessToken: input.accessToken,
      adAccountId: input.adAccountId,
      pageId: input.pageId || null,
    },
  })
}

/**
 * Creates a Campaign in Meta Ads.
 */
export async function createCampaign(accessToken: string, adAccountId: string, name: string, objective: string) {
  FacebookAdsApi.init(accessToken)
  const account = new AdAccount(adAccountId)

  const payload = new CampaignPayloadBuilder()
    .setName(name)
    .setObjective(objective)
    .setStatus('PAUSED')
    .setSpecialAdCategories([])
    .build()

  const result = await account.createCampaign([], payload)
  return result.id as string
}

/**
 * Creates an AdSet within a campaign.
 */
export async function createAdSet(
  accessToken: string,
  adAccountId: string,
  campaignId: string,
  input: MetaFullCampaignInput
) {
  FacebookAdsApi.init(accessToken)
  const account = new AdAccount(adAccountId)

  // Convert COP to cents (Meta uses smallest currency unit)
  const dailyBudgetCents = Math.round(input.dailyBudget * 100)

  const payload = new AdSetPayloadBuilder()
    .setName(`${input.name} - Ad Set`)
    .setCampaignId(campaignId)
    .setDailyBudget(dailyBudgetCents)
    .setBillingEvent('IMPRESSIONS')
    .setOptimizationGoal(objectiveToGoal(input.objective))
    .setStatus('PAUSED')
    .setSchedule(input.startDate, input.endDate)
    .setTargeting({
      countries: input.targetCountries,
      ageMin: input.targetAgeMin,
      ageMax: input.targetAgeMax,
      genders: input.targetGenders,
      interests: input.targetInterests,
    })
    .build()

  const result = await account.createAdSet([], payload)
  return result.id as string
}

/**
 * Creates an Ad with creative.
 */
export async function createAd(
  accessToken: string,
  adAccountId: string,
  adSetId: string,
  input: MetaFullCampaignInput,
  pageId: string
) {
  FacebookAdsApi.init(accessToken)
  const account = new AdAccount(adAccountId)

  // Step 1: Create the AdCreative
  const creativePayload: Record<string, any> = {
    name: `${input.name} - Creative`,
    object_story_spec: {
      page_id: pageId,
      link_data: {
        link: input.linkUrl,
        message: input.bodyText,
        name: input.headline,
        call_to_action: {
          type: input.callToAction,
          value: { link: input.linkUrl },
        },
      },
    },
  }

  // Add image if provided
  if (input.imageUrl) {
    creativePayload.object_story_spec.link_data.picture = input.imageUrl
  }

  const creative = await account.createAdCreative([], creativePayload)

  // Step 2: Create the Ad
  const adPayload = {
    name: `${input.name} - Ad`,
    adset_id: adSetId,
    creative: { creative_id: creative.id },
    status: 'PAUSED',
  }

  const ad = await account.createAd([], adPayload)
  return { adId: ad.id as string, creativeId: creative.id as string }
}

/**
 * Publishes a full campaign asynchronously.
 * Returns a tracking ID immediately, processes Meta API calls in background.
 */
export async function publishFullCampaign(
  tenantId: string,
  userId: string,
  input: MetaFullCampaignInput
): Promise<MetaPublishResult> {
  const config = await getMetaConfig(tenantId)
  let pageId = input.pageId || config.pageId

  // Auto-fetch first page if not configured
  if (!pageId) {
    try {
      FacebookAdsApi.init(config.accessToken)
      const mePages = await (new (bizSdk.User)('me')).getAccounts(['id', 'name'], { limit: 1 })
      if (mePages && mePages.length > 0) {
        pageId = mePages[0].id
        // Save for future use
        await prisma.metaAdsConfig.update({
          where: { tenantId },
          data: { pageId },
        })
      }
    } catch (e) {
      logger.warn('[META_ADS] Could not auto-fetch page ID:', (e as Error).message)
    }
  }

  if (!pageId) throw new Error('No se encontró una Página de Facebook asociada a tu cuenta. Agrega el ID de página en Meta Ads → Conectar.')

  // Create tracking record immediately
  const record = await prisma.metaAdsCampaign.create({
    data: {
      tenantId,
      trackingId: `meta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      objective: input.objective,
      dailyBudget: input.dailyBudget,
      status: 'PROCESSING',
      payload: input as any,
      createdById: userId,
    },
  })

  // Fire and forget — process in background
  processMetaCampaign(tenantId, record.id, config.accessToken, config.adAccountId, pageId, input)
    .catch(err => logger.error(`[META_ADS] Background processing failed for ${record.trackingId}:`, err))

  return {
    trackingId: record.trackingId,
    status: 'PROCESSING',
    message: 'Tu campaña se está creando en Meta. Puedes seguir su estado aquí.',
  }
}

/**
 * Background processor: creates Campaign → AdSet → Ad in Meta,
 * updates the tracking record with results or errors.
 */
async function processMetaCampaign(
  tenantId: string,
  recordId: string,
  accessToken: string,
  adAccountId: string,
  pageId: string,
  input: MetaFullCampaignInput
) {
  try {
    // Step 1: Campaign
    const metaCampaignId = await createCampaign(accessToken, adAccountId, input.name, input.objective)

    await prisma.metaAdsCampaign.update({
      where: { id: recordId },
      data: { metaCampaignId },
    })

    // Step 2: Ad Set
    const metaAdSetId = await createAdSet(accessToken, adAccountId, metaCampaignId, input)

    await prisma.metaAdsCampaign.update({
      where: { id: recordId },
      data: { metaAdSetId },
    })

    // Step 3: Ad
    const { adId } = await createAd(accessToken, adAccountId, metaAdSetId, input, pageId)

    // Success — update record
    await prisma.metaAdsCampaign.update({
      where: { id: recordId },
      data: {
        metaAdId: adId,
        status: 'ACTIVE',
      },
    })

    logger.info(`[META_ADS] Campaign published successfully: ${input.name}`)
  } catch (error: any) {
    const formatted = formatMetaError(error)
    const sentryPayload = buildSentryPayload(tenantId, 'publishFullCampaign', formatted)
    
    // Log for monitoring (Sentry integration point)
    logger.error(`[META_ADS_ERROR]`, JSON.stringify(sentryPayload))
    logger.error(`[META_ADS_ERROR] Raw:`, error?.message || error)

    // Store BOTH user message and raw error for debugging
    const debugMessage = formatted.raw && formatted.raw !== formatted.userMessage
      ? `${formatted.userMessage} | Debug: ${formatted.raw}`
      : formatted.userMessage

    // Update record with error
    await prisma.metaAdsCampaign.update({
      where: { id: recordId },
      data: {
        status: 'ERROR',
        errorMessage: debugMessage.slice(0, 500), // limit to 500 chars
      },
    })
  }
}

/**
 * Gets all Meta Ads campaigns for a tenant.
 */
export async function getMetaCampaigns(tenantId: string) {
  return await prisma.metaAdsCampaign.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  })
}

/**
 * Gets a specific campaign by tracking ID.
 */
export async function getMetaCampaignByTrackingId(tenantId: string, trackingId: string) {
  return await prisma.metaAdsCampaign.findFirst({
    where: { tenantId, trackingId },
  })
}

/**
 * Pauses or resumes a campaign in Meta.
 */
export async function toggleCampaignStatus(tenantId: string, trackingId: string, action: 'pause' | 'resume') {
  const record = await prisma.metaAdsCampaign.findFirst({ where: { tenantId, trackingId } })
  if (!record || !record.metaCampaignId) throw new Error('Campaña no encontrada o aún en procesamiento.')

  const config = await getMetaConfig(tenantId)
  FacebookAdsApi.init(config.accessToken)

  try {
    const campaign = new Campaign(record.metaCampaignId)
    const newStatus = action === 'pause' ? 'PAUSED' : 'ACTIVE'
    await campaign.update([], { status: newStatus })

    await prisma.metaAdsCampaign.update({
      where: { id: record.id },
      data: { status: newStatus },
    })

    return { status: newStatus }
  } catch (error: any) {
    const formatted = formatMetaError(error)
    throw new Error(formatted.userMessage)
  }
}

/**
 * Deletes a campaign from tracking (and optionally from Meta).
 */
export async function deleteCampaign(tenantId: string, trackingId: string) {
  const record = await prisma.metaAdsCampaign.findFirst({ where: { tenantId, trackingId } })
  if (!record) throw new Error('Campaña no encontrada.')

  // Try to delete from Meta if it was created
  if (record.metaCampaignId) {
    try {
      const config = await getMetaConfig(tenantId)
      FacebookAdsApi.init(config.accessToken)
      const campaign = new Campaign(record.metaCampaignId)
      await campaign.update([], { status: 'DELETED' })
    } catch (error) {
      // Non-critical: if Meta deletion fails, still remove from tracking
      logger.warn(`[META_ADS] Could not delete campaign from Meta: ${trackingId}`)
    }
  }

  await prisma.metaAdsCampaign.delete({ where: { id: record.id } })
  return { deleted: true }
}

