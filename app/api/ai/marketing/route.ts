import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import {
  generateCampaignContent,
  improveEmailText,
  suggestEmailReply,
  extractLeadsFromText,
  generateQuickCampaignHtml,
} from '@/lib/gemini'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'
export const maxDuration = 30 // Gemini can take a few seconds

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  try {
    const body = await request.json()
    const { action, params: nestedParams, ...restParams } = body
    // Support both { action, params: { prompt } } and { action, prompt }
    const params = nestedParams || restParams

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    switch (action) {
      case 'create-campaign': {
        const { prompt } = params
        if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
        const result = await generateCampaignContent(prompt)
        return NextResponse.json(result)
      }

      case 'improve-text': {
        const { text, instruction } = params
        if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        const improved = await improveEmailText(text, instruction || 'Hazlo más persuasivo y profesional')
        return NextResponse.json({ text: improved })
      }

      case 'suggest-reply': {
        const { leadName, lastMessages, leadStage } = params
        if (!leadName) return NextResponse.json({ error: 'Lead name is required' }, { status: 400 })
        const suggestions = await suggestEmailReply({
          leadName,
          lastMessages: lastMessages || [],
          leadStage,
        })
        return NextResponse.json({ suggestions })
      }

      case 'extract-leads': {
        const { text } = params
        if (!text) return NextResponse.json({ error: 'Text is required' }, { status: 400 })
        const leads = await extractLeadsFromText(text)
        return NextResponse.json({ leads })
      }

      case 'generate-html': {
        const { type, details } = params
        if (!type || !details) return NextResponse.json({ error: 'Type and details required' }, { status: 400 })
        const html = await generateQuickCampaignHtml(type, details)
        return NextResponse.json({ html })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error: any) {
    logger.error('[AI Marketing] Error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'AI request failed') },
      { status: 500 }
    )
  }
}
