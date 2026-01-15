import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-middleware'
import { PERMISSIONS } from '@/lib/permissions'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import sharp from 'sharp'

export async function POST(request: Request) {
  const session = await requirePermission(request as any, PERMISSIONS.MANAGE_CRM)
  
  if (session instanceof NextResponse) {
    return session
  }

  try {
    const formData = await request.formData()
    const file = formData.get('image') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Image size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = join(process.cwd(), 'public', 'uploads', 'campaigns')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const extension = file.name.split('.').pop() || 'jpg'
    const safeExt = extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    const originalFilename = `campaign-${timestamp}-${randomString}.${safeExt}`
    const originalFilepath = join(uploadsDir, originalFilename)
    const webpFilename = `campaign-${timestamp}-${randomString}.webp`
    const webpFilepath = join(uploadsDir, webpFilename)

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(originalFilepath, buffer)

    // Always generate a WebP sibling for optimization (keep original for compatibility)
    try {
      await sharp(buffer).webp({ quality: 82, effort: 5 }).toFile(webpFilepath)
    } catch {
      // If conversion fails, fall back to original
    }

    // Return public URL
    const publicUrl = existsSync(webpFilepath)
      ? `/uploads/campaigns/${webpFilename}`
      : `/uploads/campaigns/${originalFilename}`

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('Error uploading image:', error)
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    )
  }
}

