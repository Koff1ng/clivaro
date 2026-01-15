import { existsSync } from 'fs'
import { mkdir, readdir, stat } from 'fs/promises'
import { extname, join, dirname, basename } from 'path'
import sharp from 'sharp'

const ROOT = join(process.cwd(), 'public')
const QUALITY = Number(process.env.WEBP_QUALITY || 82)

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const out: string[] = []
  for (const e of entries) {
    const full = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(full)))
    else out.push(full)
  }
  return out
}

function isConvertible(p: string) {
  const ext = extname(p).toLowerCase()
  return ext === '.png' || ext === '.jpg' || ext === '.jpeg'
}

async function ensureDir(p: string) {
  const d = dirname(p)
  if (!existsSync(d)) await mkdir(d, { recursive: true })
}

async function convertOne(srcPath: string) {
  const ext = extname(srcPath)
  const outPath = join(dirname(srcPath), `${basename(srcPath, ext)}.webp`)
  if (existsSync(outPath)) return { srcPath, outPath, skipped: true }

  await ensureDir(outPath)
  await sharp(srcPath)
    .webp({ quality: QUALITY, effort: 5 })
    .toFile(outPath)

  return { srcPath, outPath, skipped: false }
}

async function main() {
  if (!existsSync(ROOT)) {
    console.error('No public/ directory found')
    process.exit(1)
  }

  const files = await walk(ROOT)
  const images = files.filter(isConvertible)
  let converted = 0
  let skipped = 0

  for (const img of images) {
    const res = await convertOne(img)
    if (res.skipped) skipped++
    else converted++
  }

  console.log(`WebP conversion done. converted=${converted} skipped=${skipped} quality=${QUALITY}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})


