import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { createClient } from '@supabase/supabase-js'
import { safeErrorMessage } from '@/lib/safe-error'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Image generation can take time

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const GEMINI_KEY = process.env.GEMINI_API_KEY || ''
const BUCKET = 'campaign-images'

// Gemini model with native image generation
const IMAGE_MODEL = 'gemini-2.0-flash-preview-image-generation'

async function ensureBucket(supabase: any) {
  const { data: buckets } = await supabase.storage.listBuckets()
  const exists = buckets?.some((b: any) => b.name === BUCKET)
  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 5 * 1024 * 1024,
    })
    if (error && !error.message?.includes('already exists')) {
      throw new Error(`No se pudo crear el bucket: ${safeErrorMessage(error)}`)
    }
  }
}

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId

  try {
    const { prompt } = await request.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt es requerido' }, { status: 400 })
    }

    if (!GEMINI_KEY) {
      return NextResponse.json({ error: 'API Key de Gemini no configurada' }, { status: 500 })
    }

    // ── Call Gemini with image generation ──
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${GEMINI_KEY}`

    const geminiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Generate a professional, high-quality marketing image for an email campaign. 
The image should be clean, modern, and look professional — suitable for a business email.
Do NOT include any text or watermarks in the image.
Description: ${prompt}`
          }]
        }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    })

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => ({}))
      logger.error('[AI Image] Gemini API error:', errData)
      return NextResponse.json(
        { error: `Error de Gemini: ${errData?.error?.message || geminiRes.statusText}` },
        { status: 502 }
      )
    }

    const geminiData = await geminiRes.json()

    // Extract image data from response
    const candidates = geminiData?.candidates || []
    let imageBase64: string | null = null
    let mimeType = 'image/png'

    for (const candidate of candidates) {
      const parts = candidate?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data
          mimeType = part.inlineData.mimeType || 'image/png'
          break
        }
      }
      if (imageBase64) break
    }

    if (!imageBase64) {
      logger.warn('[AI Image] No image in Gemini response', { candidates: JSON.stringify(candidates).slice(0, 500) })
      return NextResponse.json(
        { error: 'Gemini no generó una imagen. Intenta con un prompt diferente.' },
        { status: 422 }
      )
    }

    // ── Upload to Supabase Storage ──
    const imageBuffer = Buffer.from(imageBase64, 'base64')
    const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 10)
    const path = `${tenantId}/ai-${timestamp}-${randomStr}.${ext}`

    if (!supabaseUrl || !supabaseKey) {
      // Fallback: return base64 data URL
      const dataUrl = `data:${mimeType};base64,${imageBase64}`
      return NextResponse.json({ url: dataUrl })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    await ensureBucket(supabase)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, imageBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) {
      logger.error('[AI Image] Upload failed:', uploadError)
      // Fallback to base64
      const dataUrl = `data:${mimeType};base64,${imageBase64}`
      return NextResponse.json({ url: dataUrl })
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)

    logger.info('[AI Image] Generated and uploaded', { path, tenantId, prompt: prompt.slice(0, 60) })

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (error: any) {
    logger.error('[AI Image] Error:', error)
    return NextResponse.json(
      { error: safeErrorMessage(error, 'Error al generar imagen') },
      { status: 500 }
    )
  }
}
