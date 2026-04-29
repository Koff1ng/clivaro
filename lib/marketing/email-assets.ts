import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Replaces {{name}} and {{email}} placeholders in arbitrary text.
 * Used for both the email body (HTML) and the subject line.
 *
 * Falsy values fall back to safe defaults so we never leak literal `{{name}}`
 * to recipients when a customer record has no name.
 */
export function personalizeText(text: string, vars: { name?: string | null; email?: string | null }) {
  let out = text || ''
  const safeName = vars.name && vars.name.trim() ? vars.name : 'cliente'
  const safeEmail = vars.email && vars.email.trim() ? vars.email : ''
  out = out.replace(/\{\{name\}\}/g, safeName)
  out = out.replace(/\{\{email\}\}/g, safeEmail)
  return out
}

/** @deprecated Use `personalizeText` — kept for backwards compatibility. */
export function personalizeEmailHtml(html: string, vars: { name?: string | null; email?: string | null }) {
  return personalizeText(html, vars)
}

export function extractImagePathsFromHtml(html: string): string[] {
  const paths: string[] = []

  // Extract from img src attributes
  const imgMatches = html.match(/src=["'](\/uploads\/[^"']+)["']/gi)
  if (imgMatches) {
    imgMatches.forEach((match) => {
      const path = match.replace(/src=["']/, '').replace(/["']$/, '')
      if (!paths.includes(path)) paths.push(path)
    })
  }

  // Extract from background-image URLs
  const bgMatches = html.match(/background-image:\s*url\(["']?(\/uploads\/[^"')]+)["']?\)/gi)
  if (bgMatches) {
    bgMatches.forEach((match) => {
      const pathMatch = match.match(/\/uploads\/[^"')]+/)
      if (pathMatch) {
        const path = pathMatch[0]
        if (!paths.includes(path)) paths.push(path)
      }
    })
  }

  return paths
}

export async function prepareImageAttachments(imagePaths: string[]): Promise<
  Array<{
    filename?: string
    content: Buffer
    contentType?: string
    cid: string
  }>
> {
  const attachments: Array<{
    filename?: string
    content: Buffer
    contentType?: string
    cid: string
  }> = []

  const getContentType = (ext?: string) => {
    const extension = (ext || '').toLowerCase()
    if (extension === 'png') return 'image/png'
    if (extension === 'gif') return 'image/gif'
    if (extension === 'webp') return 'image/webp'
    return 'image/jpeg'
  }

  // For email compatibility: if HTML references .webp, embed a PNG/JPG sibling when available.
  const resolveEmailSafePath = (publicPath: string): { publicPath: string; diskPath: string } => {
    const diskPath = join(process.cwd(), 'public', publicPath)
    const extension = publicPath.split('.').pop()?.toLowerCase()
    if (extension !== 'webp') return { publicPath, diskPath }

    const withoutExt = publicPath.replace(/\.webp$/i, '')
    const candidates = [`${withoutExt}.png`, `${withoutExt}.jpg`, `${withoutExt}.jpeg`]
    for (const candidate of candidates) {
      const candidateDisk = join(process.cwd(), 'public', candidate)
      if (existsSync(candidateDisk)) {
        return { publicPath: candidate, diskPath: candidateDisk }
      }
    }

    return { publicPath, diskPath }
  }

  for (const imagePath of imagePaths) {
    try {
      const resolved = resolveEmailSafePath(imagePath)
      if (!existsSync(resolved.diskPath)) continue

      const imageBuffer = await readFile(resolved.diskPath)
      const extension = resolved.publicPath.split('.').pop()?.toLowerCase()
      const contentType = getContentType(extension)

      const filename = resolved.publicPath.split('/').pop() || 'image'
      const cid = `image-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

      attachments.push({
        filename,
        content: imageBuffer,
        contentType,
        cid,
      })
    } catch {
      // ignore per-file errors
    }
  }

  return attachments
}

export function replaceImageUrlsWithCid(html: string, imagePaths: string[], attachments: Array<{ filename?: string; cid: string }>) {
  let out = html

  // Build map for lookup
  const pathToCidMap = new Map<string, string>()
  attachments.forEach((att) => {
    if (!att.filename) return
    pathToCidMap.set(`/uploads/campaigns/${att.filename}`, att.cid)
    pathToCidMap.set(att.filename, att.cid)

    // Also map any referenced paths that share the same stem (basename without extension),
    // so /foo.webp can map to cid of foo.png (email-safe fallback).
    const stem = att.filename.replace(/\.[^.]+$/, '')
    imagePaths.forEach((p) => {
      const base = p.split('/').pop() || ''
      const baseStem = base.replace(/\.[^.]+$/, '')
      if (baseStem && baseStem === stem) {
        pathToCidMap.set(p, att.cid)
        pathToCidMap.set(`/uploads/campaigns/${base}`, att.cid)
        pathToCidMap.set(base, att.cid)
      }
    })
  })

  // Replace img src attributes
  out = out.replace(/src=["'](\/uploads\/[^"']+)["']/gi, (match, path) => {
    const cid = pathToCidMap.get(path) || pathToCidMap.get(path.split('/').pop() || '')
    if (cid) return `src="cid:${cid}"`
    return match
  })

  // Replace background-image URLs
  out = out.replace(/background-image:\s*url\(["']?(\/uploads\/[^"')]+)["']?\)/gi, (match, path) => {
    const cid = pathToCidMap.get(path) || pathToCidMap.get(path.split('/').pop() || '')
    if (cid) return `background-image: url('cid:${cid}')`
    return match
  })

  return out
}

/**
 * Replaces inline `data:image/...;base64,...` URLs in HTML with CID references
 * and produces the corresponding attachments.
 *
 * Why: many email clients (Outlook desktop, Gmail web in some flows) silently
 * drop inline base64 images, leaving emails missing visuals. CID-attached
 * images render reliably across Outlook, Gmail, Apple Mail, Yahoo, etc.
 *
 * This is a pure HTML transform — no filesystem or network I/O — so it's safe
 * to call from any request path right before `sendEmail`.
 */
export function inlineDataImagesToCid(html: string): {
  html: string
  attachments: Array<{
    filename: string
    content: Buffer
    contentType: string
    cid: string
  }>
} {
  if (!html || !html.includes('data:image/')) {
    return { html, attachments: [] }
  }

  const attachments: Array<{
    filename: string
    content: Buffer
    contentType: string
    cid: string
  }> = []

  // De-duplicate identical data URLs so we don't attach the same image twice
  // when it's referenced from multiple <img> tags.
  const dataUrlToAttachment = new Map<string, { cid: string }>()

  const handleMatch = (mimeType: string, base64: string): { cid: string } | null => {
    const dataUrlKey = `${mimeType}|${base64}`
    const existing = dataUrlToAttachment.get(dataUrlKey)
    if (existing) return existing

    try {
      const buffer = Buffer.from(base64, 'base64')
      if (buffer.length === 0) return null

      const ext = mimeType.includes('png') ? 'png'
        : mimeType.includes('webp') ? 'webp'
        : mimeType.includes('gif') ? 'gif'
        : 'jpg'
      const cid = `inline-${Date.now()}-${Math.random().toString(36).substring(2, 10)}-${attachments.length}`
      const attachment = {
        filename: `inline-${attachments.length}.${ext}`,
        content: buffer,
        contentType: mimeType,
        cid,
      }
      attachments.push(attachment)
      dataUrlToAttachment.set(dataUrlKey, { cid })
      return { cid }
    } catch {
      return null
    }
  }

  // Replace src="data:image/...;base64,..." in <img> tags
  let out = html.replace(
    /src=(["'])data:(image\/[a-zA-Z+.-]+);base64,([^"']+)\1/gi,
    (match, _quote, mimeType: string, base64: string) => {
      const result = handleMatch(mimeType, base64)
      return result ? `src="cid:${result.cid}"` : match
    },
  )

  // Replace background-image: url(data:image/...)
  out = out.replace(
    /background-image:\s*url\(\s*(["']?)data:(image\/[a-zA-Z+.-]+);base64,([^"')]+)\1\s*\)/gi,
    (match, _quote, mimeType: string, base64: string) => {
      const result = handleMatch(mimeType, base64)
      return result ? `background-image: url('cid:${result.cid}')` : match
    },
  )

  return { html: out, attachments }
}


