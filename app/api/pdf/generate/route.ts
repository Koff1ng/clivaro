import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import fs from 'fs'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: Request) {
  let browser

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { html, filename = 'documento' } = await req.json()

    if (!html) {
      return NextResponse.json({ error: 'HTML content missing' }, { status: 400 })
    }

    const isVercel = process.env.VERCEL === '1'
    let executablePath = isVercel ? await chromium.executablePath() : undefined

    if (!isVercel && !executablePath) {
      const commonPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
      for (const p of commonPaths) {
        if (fs.existsSync(p)) {
          executablePath = p
          break
        }
      }
    }

    const chromiumArgs = isVercel ? chromium.args || [] : []
    const args = isVercel
      ? [...chromiumArgs, '--hide-scrollbars', '--disable-web-security']
      : ['--no-sandbox', '--disable-setuid-sandbox']

    browser = await puppeteer.launch({
      headless: true,
      args,
      executablePath,
    })

    const page = await browser.newPage()
    
    // Set viewport enough for a normal desktop rendering before capturing PDF
    await page.setViewport({ width: 1200, height: 800 })

    await page.setContent(html, { waitUntil: 'load' })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '15mm',
        right: '15mm',
        bottom: '15mm',
        left: '15mm',
      },
      // Give puppeteer a moment to ensure all charts are rendered
      timeout: 30000
    })

    await browser.close()

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF Generation Error:', error)
    if (browser) await browser.close()
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 })
  }
}
