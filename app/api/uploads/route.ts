import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_PURCHASES)
  if (session instanceof NextResponse) return session

  const tenantId = (session.user as any).tenantId

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 10MB' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Generate unique path
    const timestamp = Date.now()
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `po-attachments/${tenantId}/${timestamp}_${safeName}`

    const buffer = Buffer.from(await file.arrayBuffer())

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      // If bucket doesn't exist, try to create it
      if (error.message?.includes('not found') || error.message?.includes('Bucket')) {
        await supabase.storage.createBucket('documents', { public: false })
        const { data: retryData, error: retryError } = await supabase.storage
          .from('documents')
          .upload(path, buffer, { contentType: file.type, upsert: false })

        if (retryError) throw retryError

        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

        return NextResponse.json({
          fileName: file.name,
          fileUrl: urlData.publicUrl,
          fileSize: file.size,
          mimeType: file.type,
          storagePath: path,
        })
      }
      throw error
    }

    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)

    return NextResponse.json({
      fileName: file.name,
      fileUrl: urlData.publicUrl,
      fileSize: file.size,
      mimeType: file.type,
      storagePath: path,
    })
  } catch (error: any) {
    logger.error('Error uploading file:', error)
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 })
  }
}
