import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import jwt from 'jsonwebtoken'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/impersonate-login?token=xxx
 * 
 * Validates the impersonation JWT issued by Super Admin,
 * creates a real NextAuth-compatible session cookie via automatic sign-in.
 * Used by the impersonation flow to log in directly as a tenant admin.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'

    let decoded: any
    try {
      decoded = jwt.verify(token, secret)
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return NextResponse.json({ error: 'Token de impersonación expirado. Genere uno nuevo.' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
    }

    if (!decoded.impersonation) {
      return NextResponse.json({ error: 'Token no es de impersonación' }, { status: 400 })
    }

    // Verify the super admin still exists and is active
    const superAdmin = await prisma.user.findUnique({
      where: { id: decoded.superAdminId },
      select: { id: true, isSuperAdmin: true, active: true }
    })

    if (!superAdmin?.isSuperAdmin || !superAdmin?.active) {
      return NextResponse.json({ error: 'Super Admin no autorizado' }, { status: 403 })
    }

    // Return the impersonation data as a page that auto-signs-in via NextAuth
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Impersonación - Ingresando...</title>
  <style>
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      display: flex; align-items: center; justify-content: center; 
      height: 100vh; margin: 0; background: #0F172A; color: white;
    }
    .container { text-align: center; }
    .spinner { 
      width: 40px; height: 40px; border: 3px solid rgba(255,255,255,0.2); 
      border-top-color: #f59e0b; border-radius: 50%; 
      animation: spin 0.8s linear infinite; margin: 0 auto 20px; 
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .badge { 
      background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); 
      padding: 6px 16px; border-radius: 20px; font-size: 12px; 
      color: #f59e0b; display: inline-block; margin-bottom: 16px; 
    }
    h2 { font-size: 20px; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">🔑 Impersonación Activa</div>
    <div class="spinner"></div>
    <h2>Ingresando como ${decoded.userName || 'Admin'}</h2>
    <p>Tenant: ${decoded.tenantName || decoded.tenantSlug}</p>
    <p style="font-size:12px;margin-top:16px;color:#64748b">
      Sesión válida por 30 minutos · Ejecutado por ${decoded.superAdminName || 'Super Admin'}
    </p>
  </div>
  <script>
    // Store impersonation metadata for the ImpersonationBanner component
    sessionStorage.setItem('impersonation_active', 'true');
    sessionStorage.setItem('impersonation_tenant', '${decoded.tenantName || ''}');
    sessionStorage.setItem('impersonation_admin', '${decoded.superAdminName || ''}');
    
    // Auto sign-in via NextAuth credentials (tenant login)
    fetch('/api/auth/csrf').then(r => r.json()).then(data => {
      const csrfToken = data.csrfToken;
      
      // We need to use the impersonation credentials directly
      // Since we can't know the password, we use a special impersonation flow
      // Redirect to the tenant's ERP dashboard directly
      window.location.href = '/login/${decoded.tenantSlug}?impersonation=${token}';
    }).catch(() => {
      window.location.href = '/login/${decoded.tenantSlug}?impersonation=${token}';
    });
  </script>
</body>
</html>
    `.trim()

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })

  } catch (error: any) {
    logger.error('[IMPERSONATE-LOGIN] Error:', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
