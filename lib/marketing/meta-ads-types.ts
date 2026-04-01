// ── Meta Ads DTOs ──
// Simplified inputs for users creating campaigns from the Clivaro dashboard

export type MetaCampaignObjective =
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'

export type MetaCampaignStatus = 'PAUSED' | 'ACTIVE'

export type MetaAdCallToAction =
  | 'LEARN_MORE'
  | 'SHOP_NOW'
  | 'SIGN_UP'
  | 'CONTACT_US'
  | 'BOOK_NOW'
  | 'GET_QUOTE'
  | 'SEND_MESSAGE'

/**
 * Simplified campaign creation input from the Clivaro UI.
 * The system handles all Meta API complexity behind the scenes.
 */
export interface MetaFullCampaignInput {
  // Campaign
  name: string
  objective: MetaCampaignObjective
  
  // Ad Set — Budget & Schedule
  dailyBudget: number          // in COP, converted to cents for Meta
  startDate: string            // ISO date
  endDate?: string             // ISO date (optional, runs indefinitely if not set)
  
  // Ad Set — Targeting (Advantage+ simplified)
  targetCountries: string[]    // ISO country codes, e.g. ['CO']
  targetAgeMin?: number        // default 18
  targetAgeMax?: number        // default 65
  targetGenders?: number[]     // [0] = all, [1] = male, [2] = female
  targetInterests?: string[]   // interest IDs from Meta
  
  // Ad Creative
  headline: string
  bodyText: string
  callToAction: MetaAdCallToAction
  imageUrl?: string            // URL to the ad image
  linkUrl: string              // destination URL when user clicks
  pageId?: string              // override tenant's default page
}

/**
 * Result returned immediately when a campaign is submitted for publishing.
 */
export interface MetaPublishResult {
  trackingId: string
  status: 'PROCESSING' | 'ACTIVE' | 'ERROR'
  message: string
}

/**
 * Full campaign status returned when polling by tracking ID.
 */
export interface MetaCampaignDetail {
  trackingId: string
  status: 'PROCESSING' | 'ACTIVE' | 'PAUSED' | 'ERROR'
  name: string
  objective: string
  dailyBudget: number
  metaCampaignId: string | null
  metaAdSetId: string | null
  metaAdId: string | null
  errorMessage: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Input for connecting a Meta account to a tenant.
 */
export interface MetaConnectInput {
  accessToken: string
  adAccountId: string   // Must start with 'act_'
  pageId?: string
}
