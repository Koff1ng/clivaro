import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    // Intentar servir el logo como favicon
    const logoPath = path.join(process.cwd(), 'public', 'clivaro-logo.webp')
    
    if (fs.existsSync(logoPath)) {
      const fileBuffer = fs.readFileSync(logoPath)
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }
    
    // Si no existe el logo, retornar un favicon simple en SVG
    const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#3b82f6"/>
      <text x="50" y="70" font-family="Arial" font-size="60" fill="white" text-anchor="middle" font-weight="bold">C</text>
    </svg>`
    
    return new NextResponse(svgFavicon, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    // Retornar un 204 No Content si hay error (el navegador usará su favicon por defecto)
    return new NextResponse(null, { status: 204 })
  }
}

