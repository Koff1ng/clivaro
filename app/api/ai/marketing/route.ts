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
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
import { safeErrorMessage } from '@/lib/safe-error'
export const maxDuration = 60 // Increased: campaign gen + image gen

const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation'
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const BUCKET = 'campaign-images'

/** Generate an image via Gemini and upload to Supabase. Returns public URL or null. */
async function generateAndUploadImage(prompt: string, tenantId: string): Promise<string | null> {
  if (!GEMINI_KEY) return null

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_KEY}`
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate a professional, high-quality marketing image for an email campaign. Clean, modern, no text or watermarks. Description: ${prompt}` }] }],
        generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
      }),
    })

    if (!res.ok) return null

    const data = await res.json()
    let imageBase64: string | null = null
    let mimeType = 'image/png'

    for (const candidate of data?.candidates || []) {
      for (const part of candidate?.content?.parts || []) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data
          mimeType = part.inlineData.mimeType || 'image/png'
          break
        }
      }
      if (imageBase64) break
    }

    if (!imageBase64) return null

    // Upload to Supabase Storage
    if (!supabaseUrl || !supabaseKey) {
      return `data:${mimeType};base64,${imageBase64}`
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const path = `${tenantId}/ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const buffer = Buffer.from(imageBase64, 'base64')

    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType: mimeType, upsert: false })
    if (error) {
      logger.warn('[AI Marketing] Image upload failed, using base64', { error: error.message })
      return `data:${mimeType};base64,${imageBase64}`
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return urlData.publicUrl
  } catch (err) {
    logger.warn('[AI Marketing] Image generation failed', { prompt: prompt.slice(0, 50) })
    return null
  }
}

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
        const result = await generateCampaignContent(prompt) as any
        const tenantId = (session.user as any).tenantId

        // Auto-generate images for blocks with empty src and descriptive alt.
        // We cap concurrent generations to keep within the 60s maxDuration; any
        // remaining image blocks are returned with `src=''` and the user can
        // generate them on demand from the editor's "Generar con Clivi IA" button.
        const MAX_AUTO_IMAGES = 3
        const blocks = result._blocks || []
        const imageBlocks = blocks.filter((b: any) => b.type === 'image' && !b.src && b.alt && b.alt.length > 10)

        if (imageBlocks.length > 0) {
          const toGenerate = imageBlocks.slice(0, MAX_AUTO_IMAGES)
          const skipped = Math.max(0, imageBlocks.length - toGenerate.length)
          logger.info(
            `[AI Marketing] Auto-generating ${toGenerate.length}/${imageBlocks.length} image(s) for campaign`,
            { tenantId, skipped },
          )

          const imageResults = await Promise.allSettled(
            toGenerate.map(async (block: any) => {
              const url = await generateAndUploadImage(block.alt, tenantId)
              if (url) block.src = url
              return !!url
            }),
          )

          const generated = imageResults.filter(r => r.status === 'fulfilled' && r.value === true).length
          const failed = toGenerate.length - generated

          result._blocks = blocks
          result._imageGeneration = {
            requested: imageBlocks.length,
            generated,
            failed,
            skippedDueToLimit: skipped,
          }
        }

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
